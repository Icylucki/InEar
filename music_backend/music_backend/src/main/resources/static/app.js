
const API = "http://localhost:8080/songs";
const AUTH_API = "http://localhost:8080/api/auth";

let playlist = [];
let currentIndex = 0;
let currentWave = null;
let currentBtn = null;
let isRegisterMode = false;
let loggedUser = null;

// ========================================
// NAVEGACIÓN
// ========================================

function showSection(id) {
    const target = document.getElementById(id);
    if (!target) return;

    if (id !== "authSection" && !loggedUser) {
        document.querySelectorAll(".section").forEach(section => {
            section.classList.remove("active");
        });

        document.getElementById("authSection")?.classList.add("active");
        return;
    }

    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    target.classList.add("active");

    if (id === "home") {
        loadRecommendations();
    }

    if (id === "profile") {
        loadMySongs();
    }
}

// CORREGIDO: esta función queda fuera de las demás.
function setNavigationVisibility(isLoggedIn) {
    const nav = document.getElementById("privateNav");

    if (nav) {
        nav.hidden = !isLoggedIn;
    }
}

// ========================================
// OBTENER CANCIONES Y PROYECTOS
// ========================================

async function getSongs() {
    const response = await fetch(API, {
        credentials: "include"
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            "No se pudieron cargar los proyectos."
        );
    }

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.songs)) return data.songs;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.data)) return data.data;

    console.error("Respuesta inesperada de /songs:", data);

    throw new Error(
        "El servidor no devolvió una lista de proyectos. Revisá la respuesta de /songs."
    );
}

// ========================================
// RECOMENDACIONES
// ========================================

async function loadRecommendations() {
    const list = document.getElementById("recommendedList");
    if (!list) return;

    try {
        const songs = await getSongs();

        clearPlaylist();
        list.innerHTML = "";

        const orderedSongs = [...songs].sort((a, b) => {
            const dateA = new Date(a.uploadDate || 0).getTime() || 0;
            const dateB = new Date(b.uploadDate || 0).getTime() || 0;
            return dateB - dateA;
        });

        if (orderedSongs.length === 0) {
            list.textContent = "Todavía no hay proyectos para mostrar.";
            return;
        }

        orderedSongs.forEach(song => createSongCard(song, list));

    } catch (error) {
        console.error("Error al cargar recomendaciones:", error);
        list.innerHTML = "";

        const message = document.createElement("p");
        message.textContent = error.message;
        list.appendChild(message);
    }
}

// ========================================
// REPRODUCTOR
// ========================================

function clearPlaylist() {
    playlist.forEach(item => {
        try {
            item.wave.destroy();
        } catch (error) {
            console.warn("No se pudo cerrar un reproductor:", error);
        }
    });

    playlist = [];
    currentIndex = 0;
    currentWave = null;
    currentBtn = null;
}

function setPlayIcon(btn) {
    btn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21"></polygon>
        </svg>`;
}

function setPauseIcon(btn) {
    btn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <rect x="5" y="3" width="5" height="18"></rect>
            <rect x="14" y="3" width="5" height="18"></rect>
        </svg>`;
}

function playNextSong() {
    if (currentBtn) setPlayIcon(currentBtn);

    currentIndex++;

    if (currentIndex < playlist.length) {
        const next = playlist[currentIndex];

        currentWave = next.wave;
        currentBtn = next.btn;

        next.wave.play();
        setPauseIcon(next.btn);
        next.wave.once("finish", playNextSong);
    } else {
        currentWave = null;
        currentBtn = null;
        currentIndex = 0;
    }
}

// ========================================
// TARJETAS DE CANCIONES
// ========================================

function createSongCard(song, container, profile = false) {
    if (!container) return;

    const div = document.createElement("div");
    div.className = "song";

    const suffix = profile ? `profile-${song.id}` : song.id;
    const waveId = `wave-${suffix}`;
    const btnId = `play-${suffix}`;

    const cover = document.createElement("img");
    cover.src = `http://localhost:8080/uploads/${song.coverPath || ""}`;
    cover.alt = `Portada de ${song.title || "proyecto"}`;

    const info = document.createElement("div");
    info.className = "song-info";
    info.textContent =
        `${song.title || "Sin título"} - ${song.artist || "Sin artista"} (${song.genre || "Sin género"})`;

    const waveWrapper = document.createElement("div");
    waveWrapper.className = "wave-wrapper";

    const waveContainer = document.createElement("div");
    waveContainer.className = "wave-container";
    waveContainer.id = waveId;

    const btn = document.createElement("button");
    btn.className = "play-btn";
    btn.id = btnId;
    btn.type = "button";
    btn.setAttribute("aria-label", "Reproducir o pausar");

    waveWrapper.append(waveContainer, btn);
    div.append(cover, info, waveWrapper);

    if (profile) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "🗑";
        deleteBtn.setAttribute("aria-label", "Eliminar proyecto");
        deleteBtn.addEventListener("click", () => deleteSong(song.id));
        div.appendChild(deleteBtn);
    }

    container.appendChild(div);

    if (typeof WaveSurfer === "undefined") {
        console.error("WaveSurfer no está cargado.");
        btn.disabled = true;
        return;
    }

    const wavesurfer = WaveSurfer.create({
        container: waveContainer,
        waveColor: "#8a2be2",
        progressColor: "#ff5500",
        height: 80,
        normalize: true
    });

    const audioPath = song.audioPath || "";

    wavesurfer.load(
        `http://localhost:8080/uploads/${audioPath}`
    );

    setPlayIcon(btn);

    const item = { wave: wavesurfer, btn };
    playlist.push(item);

    btn.addEventListener("click", () => {
        if (currentWave && currentWave !== wavesurfer) {
            currentWave.pause();
            if (currentBtn) setPlayIcon(currentBtn);
        }

        if (wavesurfer === currentWave && wavesurfer.isPlaying()) {
            wavesurfer.pause();
            setPlayIcon(btn);
            currentWave = null;
            currentBtn = null;
            return;
        }

        currentWave = wavesurfer;
        currentBtn = btn;
        currentIndex = playlist.findIndex(
            entry => entry.wave === wavesurfer
        );

        wavesurfer.play();
        setPauseIcon(btn);
    });

    wavesurfer.on("finish", () => {
        if (currentWave !== wavesurfer) return;

        setPlayIcon(btn);
        playNextSong();
    });

    wavesurfer.on("error", error => {
        console.error("Error al cargar el audio:", error);
    });
}

// ========================================
// PERFIL: PROYECTOS DEL USUARIO
// ========================================

async function loadMySongs() {
    const list = document.getElementById("mySongsList");
    if (!list) return;

    list.innerHTML = "Cargando proyectos...";

    try {
        const songs = await getSongs();

        clearPlaylist();
        list.innerHTML = "";

        if (songs.length === 0) {
            list.textContent = "Todavía no tenés proyectos cargados.";
            return;
        }

        songs.forEach(song => createSongCard(song, list, true));

    } catch (error) {
        console.error("Error al cargar tus proyectos:", error);
        list.textContent = error.message;
    }
}

// ========================================
// SUBIR PROYECTO / CANCIÓN
// ========================================

async function addSong() {
    const title = document.getElementById("title")?.value.trim();
    const artist = document.getElementById("artist")?.value.trim();
    const genre = document.getElementById("songGenre")?.value;
    const file = document.getElementById("file")?.files[0];
    const cover = document.getElementById("cover")?.files[0];

    if (!title || !artist || !genre || !file || !cover) {
        alert("Completá todos los campos y seleccioná el audio y la portada.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("genre", genre);
    formData.append("file", file);
    formData.append("cover", cover);

    try {
        const response = await fetch(`${API}/upload`, {
            method: "POST",
            credentials: "include",
            body: formData
        });

        if (!response.ok) {
            throw new Error("No se pudo subir el proyecto.");
        }

      const campos = ["title", "artist", "songGenre", "file", "cover"];

      campos.forEach(id => {
          const campo = document.getElementById(id);

          if (campo) {
              campo.value = "";
          } else {
              console.error(`No se encontró el campo HTML con id="${id}"`);
          }
      });

        alert("Proyecto subido correctamente.");
        await loadMySongs();

    } catch (error) {
        console.error("Error al subir el proyecto:", error);
        alert(error.message);
    }
}

// ========================================
// ELIMINAR PROYECTO
// ========================================

globalThis.deleteSong = async function(id) {
    if (!confirm("¿Deseás eliminar este proyecto?")) return;

    try {
        const response = await fetch(`${API}/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("No se pudo eliminar el proyecto.");
        }

        await loadMySongs();

    } catch (error) {
        console.error("Error al eliminar:", error);
        alert(error.message);
    }
};

// ========================================
// BUSCADOR Y FILTROS
// ========================================

async function applyFilter() {
    const searchText =
        document.getElementById("searchInput")?.value.toLowerCase() || "";

    const genre =
        document.getElementById("genreFilter")?.value || "";

    const list = document.getElementById("recommendedList");
    if (!list) return;

    try {
        const songs = await getSongs();

        clearPlaylist();
        list.innerHTML = "";

        const filtered = songs.filter(song => {
            const title = (song.title || "").toLowerCase();
            const artist = (song.artist || "").toLowerCase();

            const matchText =
                title.includes(searchText) ||
                artist.includes(searchText);

            const matchGenre =
                genre === "" || song.genre === genre;

            return matchText && matchGenre;
        });

        if (filtered.length === 0) {
            list.textContent = "No se encontraron proyectos.";
            return;
        }

        filtered.forEach(song => createSongCard(song, list));

    } catch (error) {
        console.error("Error al filtrar proyectos:", error);
        list.textContent = error.message;
    }
}

// ========================================
// PARALLAX
// ========================================

globalThis.addEventListener("scroll", () => {
    const background = document.querySelector(".bg-parallax");

    if (background) {
        background.style.transform =
            `translateY(${globalThis.scrollY * 0.3}px)`;
    }
});

// ========================================
// AUTENTICACIÓN
// ========================================

async function authRequest(endpoint, data) {
    const response = await fetch(`${AUTH_API}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message ||
            result.error ||
            "No se pudo completar la operación."
        );
    }

    return result;
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;

    document.getElementById("authTitle").textContent =
        isRegisterMode ? "Crear cuenta" : "Iniciar sesión";

    document.getElementById("authSubmit").textContent =
        isRegisterMode ? "Registrarme" : "Iniciar sesión";

    document.getElementById("nameField").hidden = !isRegisterMode;

    document.getElementById("authSwitchText").textContent =
        isRegisterMode ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?";

    document.getElementById("authSwitch").textContent =
        isRegisterMode ? "Iniciar sesión" : "Crear cuenta";

    document.getElementById("authMessage").textContent = "";
}

// ========================================
// COMPROBAR SESIÓN
// ========================================

async function checkLogin() {
    try {
        const response = await fetch(`${AUTH_API}/me`, {
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("No hay una sesión iniciada.");
        }

        loggedUser = await response.json();

        setNavigationVisibility(true);
        showSection("home");

    } catch {
        loggedUser = null;
        setNavigationVisibility(false);

        document.querySelectorAll(".section").forEach(section => {
            section.classList.remove("active");
        });

        document.getElementById("authSection")?.classList.add("active");
    }
}

// ========================================
// INICIALIZAR INEAR
// ========================================

function initializeInEar() {
    const authForm = document.getElementById("authForm");

    if (!authForm) {
        console.error("No se encontró el formulario authForm.");
        return;
    }

    authForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("authMessage");
        const button = document.getElementById("authSubmit");

        const name = document.getElementById("authName").value.trim();
        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;

        message.textContent = "";
        button.disabled = true;

        try {
            if (isRegisterMode) {
                if (!name) {
                    throw new Error("Ingresá tu nombre.");
                }

                await authRequest("register", {
                    name,
                    email,
                    password
                });
            }

            await authRequest("login", {
                email,
                password
            });

            const response = await fetch(`${AUTH_API}/me`, {
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("No se pudo verificar la sesión.");
            }

            loggedUser = await response.json();

            // CORREGIDO: mostrar los botones al iniciar sesión.
            setNavigationVisibility(true);
            showSection("home");

        } catch (error) {
            message.textContent =
                error.message || "Error al iniciar sesión.";

            console.error("Error de autenticación:", error);

        } finally {
            button.disabled = false;
        }
    });

    checkLogin();
}

// Ejecutar incluso si este archivo se carga después de DOMContentLoaded.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeInEar);
} else {
    initializeInEar();
}

// ========================================
// CERRAR SESIÓN
// ========================================

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
        const response = await fetch(`${AUTH_API}/logout`, {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("No se pudo cerrar la sesión.");
        }

        window.location.reload();

    } catch (error) {
        console.error(error);
        alert("No se pudo cerrar la sesión. Intentá nuevamente.");
    }
});
