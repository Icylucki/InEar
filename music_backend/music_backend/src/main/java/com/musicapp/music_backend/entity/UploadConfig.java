package com.musicapp.music_backend.entity;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.context.annotation.Configuration;

@Configuration
public class UploadConfig {

    public Path getUploadPath() {
        return Paths.get("uploads")
                .toAbsolutePath()
                .normalize();
    }
}
