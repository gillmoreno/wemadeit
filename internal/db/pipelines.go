package db

import (
	"time"

	"wemadeit/internal/models"
)

func (s *Store) SavePipeline(p models.Pipeline) error {
	isDefault := 0
	if p.Default {
		isDefault = 1
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO pipelines
		(id, name, description, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?);`,
		p.ID,
		p.Name,
		p.Description,
		isDefault,
		p.CreatedAt.Unix(),
		p.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadPipelines() ([]models.Pipeline, error) {
	rows, err := s.DB.Query(`SELECT id, name, description, is_default, created_at, updated_at FROM pipelines ORDER BY is_default DESC, created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pipelines := make([]models.Pipeline, 0)
	for rows.Next() {
		var p models.Pipeline
		var isDefault int
		var createdUnix, updatedUnix int64
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &isDefault, &createdUnix, &updatedUnix); err != nil {
			return nil, err
		}
		p.Default = isDefault != 0
		p.CreatedAt = time.Unix(createdUnix, 0)
		p.UpdatedAt = time.Unix(updatedUnix, 0)
		pipelines = append(pipelines, p)
	}
	return pipelines, rows.Err()
}

func (s *Store) SavePipelineStage(st models.PipelineStage) error {
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO pipeline_stages
		(id, pipeline_id, name, color, position, probability, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
		st.ID,
		st.PipelineID,
		st.Name,
		st.Color,
		st.Position,
		st.Probability,
		st.CreatedAt.Unix(),
		st.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadPipelineStages() ([]models.PipelineStage, error) {
	rows, err := s.DB.Query(`SELECT id, pipeline_id, name, color, position, probability, created_at, updated_at FROM pipeline_stages ORDER BY pipeline_id ASC, position ASC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]models.PipelineStage, 0)
	for rows.Next() {
		var st models.PipelineStage
		var createdUnix, updatedUnix int64
		if err := rows.Scan(&st.ID, &st.PipelineID, &st.Name, &st.Color, &st.Position, &st.Probability, &createdUnix, &updatedUnix); err != nil {
			return nil, err
		}
		st.CreatedAt = time.Unix(createdUnix, 0)
		st.UpdatedAt = time.Unix(updatedUnix, 0)
		stages = append(stages, st)
	}
	return stages, rows.Err()
}

func (s *Store) LoadPipelineStagesByPipeline(pipelineID string) ([]models.PipelineStage, error) {
	rows, err := s.DB.Query(`SELECT id, pipeline_id, name, color, position, probability, created_at, updated_at FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC;`, pipelineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]models.PipelineStage, 0)
	for rows.Next() {
		var st models.PipelineStage
		var createdUnix, updatedUnix int64
		if err := rows.Scan(&st.ID, &st.PipelineID, &st.Name, &st.Color, &st.Position, &st.Probability, &createdUnix, &updatedUnix); err != nil {
			return nil, err
		}
		st.CreatedAt = time.Unix(createdUnix, 0)
		st.UpdatedAt = time.Unix(updatedUnix, 0)
		stages = append(stages, st)
	}
	return stages, rows.Err()
}
