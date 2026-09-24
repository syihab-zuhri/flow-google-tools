CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
    description TEXT NOT NULL DEFAULT '',
    graph_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}' CHECK (json_valid(graph_json)),
    settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE project_assets (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_kind TEXT NOT NULL CHECK (
        asset_kind IN (
            'reference_image',
            'source_clip',
            'generated_clip',
            'extracted_frame',
            'exported_video'
        )
    ),
    relative_path TEXT NOT NULL CHECK (length(trim(relative_path)) > 0),
    media_type TEXT NOT NULL CHECK (length(trim(media_type)) > 0),
    created_at TEXT NOT NULL,
    UNIQUE (project_id, relative_path)
) STRICT;

CREATE TABLE segments (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL CHECK (sequence_order >= 0),
    prompt_text TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'manual_handoff',
    status TEXT NOT NULL CHECK (
        status IN ('draft', 'prepared', 'imported', 'processing', 'completed', 'failed')
    ),
    video_asset_id TEXT REFERENCES project_assets(id) ON DELETE SET NULL,
    reference_frame_asset_id TEXT REFERENCES project_assets(id) ON DELETE SET NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 3),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (project_id, sequence_order)
) STRICT;

CREATE TABLE generation_log (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
    provider_mode TEXT NOT NULL CHECK (provider_mode IN ('manual_handoff', 'official_api')),
    response_status TEXT NOT NULL CHECK (
        response_status IN ('prepared', 'imported', 'completed', 'failed', 'cancelled')
    ),
    request_fingerprint TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
) STRICT;

CREATE INDEX idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX idx_segments_project_sequence ON segments(project_id, sequence_order);
CREATE INDEX idx_generation_log_project_started ON generation_log(project_id, started_at DESC);
