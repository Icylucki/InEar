package com.musicapp.music_backend;

import com.musicapp.music_backend.entity.AppUser;
import com.musicapp.music_backend.repository.AppUserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record RegisterRequest(
            String name, String email, String password) {}

    public record LoginRequest(
            String email, String password) {}

    public record ProfileRequest(
            String name, String email) {}

    public record UserResponse(
            Long id, String name, String email) {}

    private UserResponse toResponse(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail()
        );
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(
            @RequestBody RegisterRequest data) {

        if (data.name() == null || data.name().isBlank()
                || data.email() == null || data.email().isBlank()
                || data.password() == null
                || data.password().length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Completá nombre y correo, y usá una contraseña de al menos 8 caracteres."
            );
        }

        String email = data.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ese correo ya está registrado."
            );
        }

        AppUser user = new AppUser();
        user.setName(data.name().trim());
        user.setEmail(email);
        user.setPasswordHash(
                passwordEncoder.encode(data.password())
        );

        AppUser saved = userRepository.save(user);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(toResponse(saved));
    }

    @PostMapping("/login")
    public UserResponse login(
            @RequestBody LoginRequest data,
            HttpServletRequest request) {

        if (data.email() == null || data.password() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ingresá correo y contraseña."
            );
        }

        AppUser user = userRepository
                .findByEmailIgnoreCase(data.email().trim())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Correo o contraseña incorrectos."
                ));

        if (!passwordEncoder.matches(
                data.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Correo o contraseña incorrectos."
            );
        }

        request.changeSessionId();
        request.getSession(true).setAttribute("userId", user.getId());

        return toResponse(user);
    }

    @GetMapping("/me")
    public UserResponse me(HttpSession session) {
        return toResponse(getSessionUser(session));
    }

    @PutMapping("/profile")
    public UserResponse updateProfile(
            @RequestBody ProfileRequest data,
            HttpSession session) {

        AppUser user = getSessionUser(session);

        if (data.name() == null || data.name().isBlank()
                || data.email() == null || data.email().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nombre y correo son obligatorios."
            );
        }

        String email = data.email().trim().toLowerCase(Locale.ROOT);

        boolean emailUsed = userRepository
                .findByEmailIgnoreCase(email)
                .filter(existing -> !existing.getId().equals(user.getId()))
                .isPresent();

        if (emailUsed) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ese correo ya pertenece a otra cuenta."
            );
        }

        user.setName(data.name().trim());
        user.setEmail(email);

        return toResponse(userRepository.save(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        session.invalidate();
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
                        "La cuenta ya no existe."
                ));
    }
}
