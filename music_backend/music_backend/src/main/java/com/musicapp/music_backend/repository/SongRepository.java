package com.musicapp.music_backend.repository;

import com.musicapp.music_backend.entity.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SongRepository extends JpaRepository<Song, Long> {

    List<Song> findAllByOwner_Id(Long userId);

    Optional<Song> findByIdAndOwner_Id(Long id, Long userId);


    boolean existsByAudioPath(String audioPath);

    boolean existsByCoverPath(String coverPath);


}