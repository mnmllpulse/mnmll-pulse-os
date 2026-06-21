-- 0005_tracks.sql — Track Analyzer data layer (v2, полные данные)
-- Dark Mnmll Pulse OS — Music Intelligence Layer
--
-- bpm/key_signature/label теперь заполнены по каждому треку — данные
-- от автора проекта, не выдуманы. Несколько BPM сильно выбиваются за
-- жанровый диапазон (Alex Vanni 159, DJ Starkey 65, Dj Judi 77,
-- Sanckler 83, Adn 110, Electrypnose 102) — оставлены как переданы,
-- не скорректированы автоматически.

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  subgenre TEXT NOT NULL,
  sound_direction TEXT,
  label TEXT,
  bpm INTEGER,
  key_signature TEXT,
  role TEXT NOT NULL DEFAULT 'reference',
  status TEXT,
  release_date TEXT,
  notes TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_subgenre ON tracks(subgenre);
CREATE INDEX IF NOT EXISTS idx_tracks_role ON tracks(role);

INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('alex-vanni-flame-extended-mix', 'Alex Vanni', 'Flame (Extended Mix)', 'Melodic House & Techno', NULL, 'Enormous Vision', 159, 'F Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('nem3si-metamorphosis', 'NEM3SI$', 'Metamorphosis', 'Melodic House & Techno', NULL, 'Infinite Resistance', 126, 'E Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('agguiar-bitter-little-lies-original-mix', 'Agguiar', 'Bitter Little Lies (Original Mix)', 'Melodic House & Techno', NULL, 'Vantasoma Records', 126, 'Ab Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('neon-obsidian-chains-of-time-original-mix', 'Neon Obsidian', 'Chains of Time (Original Mix)', 'Melodic House & Techno', NULL, 'Neon Obsidian Records', 124, 'C Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('galuka-o-infinito-somos-n-s-original-mix', 'Galuka', 'O Infinito Somos Nós (Original Mix)', 'Melodic House & Techno', NULL, 'Addictive Sounds', 126, 'G Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('sanckler-nebula-drift', 'Sanckler', 'Nebula Drift', 'Melodic House & Techno', NULL, 'GLK Records', 83, 'F Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('adn-manipulation-of-souls', 'Adn', 'Manipulation Of Souls', 'Melodic House & Techno', NULL, 'Symphonic Starter', 110, 'A Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('xiner-future', 'XINER', 'Future', 'Melodic House & Techno', NULL, 'Los Underground', 125, 'E Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('just-ben-freak-e-beatz-rt-sg-echos', 'Just Ben, Freak E Beatz & RT (SG)', 'Echos', 'Melodic House & Techno', NULL, 'RISING HRMNY', 128, 'A Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('alex-deeper-hold-me-close', 'Alex Deeper', 'Hold Me Close', 'Melodic House & Techno', NULL, 'CROCUS', 128, 'Eb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('hypnoza-awaken-the-mind', 'HYPNOZA', 'Awaken the Mind', 'Melodic House & Techno', NULL, 'PinkStar Black', 126, 'G Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('agents-of-time-darla-jade-stay-with-me', 'Agents Of Time, Darla Jade', 'Stay With Me', 'Melodic House & Techno', NULL, 'Time Machine Recordings', 130, 'F Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('dj-starkey-i-run', 'DJ Starkey', 'I Run', 'Melodic House & Techno', NULL, 'DistroKid', 65, 'Gb Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('sohrab-bahaei-ewigkeit', 'SOHRAB BAHAEI', 'Ewigkeit', 'Melodic House & Techno', NULL, 'DeepShine Music', 125, 'Gb Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('lacey-seb-hennig-beholder-you-never-seen', 'Lacey, Seb Hennig, Beholder.', 'You Never Seen', 'Melodic House & Techno', NULL, 'Exx Boundless', 126, 'D Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('dj-judi-mr-deep-deepmaniak-good-love', 'Dj Judi, Mr Deep & Deepmaniak', 'Good Love', 'Melodic House & Techno', NULL, 'Unique Deep', 77, 'E Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('inamar-your-love-gets-me-high', 'INAMAR', 'Your Love Gets Me High', 'Melodic House & Techno', NULL, 'PinkStar Black', 126, 'Ab Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('alfred-beck-anastasiia-nemila-feel-me', 'Alfred Beck, ANASTASiiA, Nemila', 'Feel Me', 'Melodic House & Techno', NULL, 'Enormous Vision', 126, 'Gb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('hafex-maxtage-between-your-sighs-breezy-remix', 'Hafex, MAXTAGE', 'Between Your Sighs (.breezy Remix)', 'Melodic House & Techno', NULL, 'SSL Music', 126, 'F Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('anvero-jordan-grace-find-your-space', 'Anvero & Jordan Grace', 'Find Your Space', 'Melodic House & Techno', NULL, 'ANVA Records', 124, 'D Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('thereweretwo-all-i-need', 'ThereWereTwo', 'All I Need', 'Melodic House & Techno', NULL, 'HOPELESS MUSIC', 124, 'D Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('sylent-de-make-you-mine', 'Sylent (DE)', 'Make You Mine', 'Techno (Peak Time / Driving)', NULL, 'Animarum Recordings', 140, 'Ab Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('luca-napoli-ghoul-za-alves-pt-atari', 'Luca Napoli, Ghoul (ZA), ALVES (PT)', 'Atari', 'Techno (Peak Time / Driving)', NULL, 'Set About Music', 140, 'Gb Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('roger-lavelle-energized', 'Roger Lavelle', 'Energized', 'Techno (Peak Time / Driving)', NULL, 'Modular States', 138, 'G Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('droplex-domination', 'Droplex', 'Domination', 'Techno (Peak Time / Driving)', NULL, 'White Face Recordings', 138, 'Db Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('demon-noise-signals', 'Demon Noise', 'Signals', 'Techno (Peak Time / Driving)', NULL, 'Skullduggery', 138, 'Eb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('gerard-h-out-of-your-mind', 'Gerard H', 'Out of Your Mind', 'Techno (Peak Time / Driving)', NULL, 'Animarum Recordings', 140, 'G Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('basilone-morse-x-code-detcord-voltage', 'Basilone, Morse X Code, Detcord', 'Voltage', 'Techno (Peak Time / Driving)', NULL, 'Replicate Records', 136, 'Bb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('lampe-forever', 'Lampe', 'Forever', 'Techno (Peak Time / Driving)', 'minimal', 'Subios Records', 130, 'E Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('electrypnose-influenced-luis-m-remix', 'Electrypnose', 'Influenced (Luis M Remix)', 'Techno (Peak Time / Driving)', 'minimal', 'AlpaKa MuziK', 102, 'E Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('roman-adam-the-curse', 'Roman Adam', 'The Curse', 'Techno (Peak Time / Driving)', 'minimal', 'Alula Tunes', 132, 'Eb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('marca-frequency-ritual', 'Marca Frequency', 'Ritual', 'Techno (Peak Time / Driving)', 'minimal', 'Subios Records', 128, 'Eb Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('oscar-l-still-human', 'Oscar L', 'Still Human', 'Techno (Peak Time / Driving)', 'minimal', 'Truesoul', 127, 'A Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('taavi-excuses-carbon-remix', 'Taavi', 'Excuses (Carbon Remix)', 'Techno (Peak Time / Driving)', 'minimal', 'Alula Tunes', 130, 'F Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('marca-frequency-totem', 'Marca Frequency', 'Totem', 'Techno (Peak Time / Driving)', 'minimal', 'Subios Records', 130, 'B Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('j-fay-dianthe-erebus-monococ-remix', 'J.Fay & Dianthe', 'Erebus (Monococ Remix)', 'Techno (Peak Time / Driving)', 'minimal', 'Lucid Kat Recordings', 129, 'Gb Minor', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('marca-frequency-totem-koda-remix', 'Marca Frequency', 'Totem (KODA Remix)', 'Techno (Peak Time / Driving)', 'minimal', 'Subios Records', 130, 'B Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('monococ-mrmsoun6-deep-space', 'Monococ & mrmsoun6', 'Deep Space', 'Techno (Peak Time / Driving)', 'minimal', 'Joker Black Label', 130, 'F Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('droplex-disconnection', 'Droplex', 'Disconnection', 'Techno (Peak Time / Driving)', 'minimal', 'White Face Recordings', 129, 'D Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role) VALUES ('luis-m-ancient-matter', 'Luis M', 'Ancient Matter', 'Techno (Peak Time / Driving)', 'minimal', 'Digital Structures', 130, 'Db Major', 'reference');
INSERT OR IGNORE INTO tracks (id, artist, title, subgenre, sound_direction, label, bpm, key_signature, role, status) VALUES ('mnmllpulse-dark-is-deeper', 'mnmllpulse', 'dark is deeper', 'Techno (Peak Time / Driving)', 'minimal', NULL, 130, NULL, 'own_release', 'released');
