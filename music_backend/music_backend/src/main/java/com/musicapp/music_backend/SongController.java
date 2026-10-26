
        package com.musicapp.music_backend;

import com.musicapp.music_backend.entity.AppUser;
import com.musicapp.music_backend.entity.Song;
import com.musicapp.music_backend.entity.UploadConfig;
import com.musicapp.music_backend.repository.AppUserRepository;
import com.musicapp.music_backend.repository.SongRepository;

import jakarta.servlet.http.HttpSession;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@CrossOrigin
@RequestMapping("/songs")
public class SongController {

    private final AppUserRepository userRepository;
    private final SongRepository songRepository;
    private final UploadConfig uploadConfig;

    public SongController(
            SongRepository songRepository,
            UploadConfig uploadConfig,
            AppUserRepository userRepository) {

        this.songRepository = songRepository;
        this.uploadConfig = uploadConfig;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Song> getAllSongs(HttpSession session) {
        AppUser user = getSessionUser(session);

        return songRepository.findAllByOwner_Id(user.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Song> getSongById(
            @PathVariable Long id,
            HttpSession session) {

        AppUser user = getSessionUser(session);

        return songRepository
                .findByIdAndOwner_Id(id, user.getId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/upload")
    public ResponseEntity<Song> uploadSong(
            @RequestParam("title") String title,
            @RequestParam("artist") String artist,
            @RequestParam("genre") String genre,
            @RequestParam("file") MultipartFile file,
            @RequestParam("cover") MultipartFile cover,
            HttpSession session) {

        AppUser user = getSessionUser(session);

        if (title.isBlank() || artist.isBlank() || genre.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Completá el título, artista y género."
            );
        }

        if (file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El archivo de audio llegó vacío."
            );
        }

        if (cover.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El archivo de portada llegó vacío."
            );
        }

        Path folder = uploadConfig.getUploadPath();

        String audioName = UUID.randomUUID()
                + getSafeExtension(file.getOriginalFilename());

        String coverName = UUID.randomUUID()
                + getSafeExtension(cover.getOriginalFilename());

        Path audioPath = folder.resolve(audioName).normalize();
        Path coverPath = folder.resolve(coverName).normalize();

        try {
            Files.createDirectories(folder);

            file.transferTo(audioPath);
            cover.transferTo(coverPath);

            Song song = new Song();

            song.setOwner(user);
            song.setTitle(title.trim());
            song.setArtist(artist.trim());
            song.setGenre(genre.trim());
            song.setAudioPath(audioName);
            song.setCoverPath(coverName);
            song.setOriginalFileName(file.getOriginalFilename());
            song.setUploadDate(LocalDateTime.now());

            Song savedSong = songRepository.save(song);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(savedSong);

        } catch (IOException | RuntimeException e) {
            deleteFileQuietly(audioPath);
            deleteFileQuietly(coverPath);

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se pudo guardar el audio y la portada.",
                    e
            );
        }
    }


    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSong(
            @PathVariable Long id,
            HttpSession session) {

        AppUser user = getSessionUser(session);

        Song song = songRepository
                .findByIdAndOwner_Id(id, user.getId())
                .orElse(null);

        if (song == null) {
            return ResponseEntity.notFound().build();
        }

        Path folder = uploadConfig.getUploadPath();

        Path audio = resolveStoredFile(folder, song.getAudioPath());
        Path cover = resolveStoredFile(folder, song.getCoverPath());

        // Guardamos los nombres antes de eliminar el registro.
        String audioName = song.getAudioPath();
        String coverName = song.getCoverPath();

        // Eliminamos el registro de la base de datos.
        songRepository.delete(song);

        // Borramos los archivos solamente si ninguna otra canción los usa.
        if (audioName != null &&
                !songRepository.existsByAudioPath(audioName)) {
            deleteFileQuietly(audio);
        }

        if (coverName != null &&
                !songRepository.existsByCoverPath(coverName)) {
            deleteFileQuietly(cover);
        }

        return ResponseEntity.noContent().build();
    }

    private AppUser getSessionUser(HttpSession session) {
        Object id = session.getAttribute("userId");

        if (!(id instanceof Long userId)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Iniciá sesión para continuar."
            );
        }

        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "La cuenta no existe."
                ));
    }

    private String getSafeExtension(String filename) {
        if (filename == null || filename.isBlank()) {
            return "";
        }

        String cleanName = filename.replace("\\", "/");
        cleanName = cleanName.substring(
                cleanName.lastIndexOf('/') + 1
        );

        int dot = cleanName.lastIndexOf('.');

        if (dot < 0) {
            return "";
        }

        String extension = cleanName.substring(dot);

        if (!extension.matches("\\.[a-zA-Z0-9]{1,10}")) {
            return "";
        }

        return extension.toLowerCase();
    }

    private Path resolveStoredFile(Path folder, String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }

        Path normalizedFolder = folder.toAbsolutePath().normalize();
        Path resolved = normalizedFolder.resolve(filename).normalize();

        if (!resolved.startsWith(normalizedFolder)) {
            return null;
        }

        return resolved;
    }

    private void deleteFileQuietly(Path path) {
        if (path == null) {
            return;
        }

        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            System.err.println(
                    "No se pudo eliminar el archivo: " + path
            );
        }
    }
}
