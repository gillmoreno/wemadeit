package db

import (
	"database/sql"
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

func (s *Store) DeletePipeline(pipelineID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var wasDefault int
	if err = tx.QueryRow(`SELECT is_default FROM pipelines WHERE id = ? LIMIT 1;`, pipelineID).Scan(&wasDefault); err != nil {
		if err == sql.ErrNoRows {
			err = tx.Commit()
			return err
		}
		return err
	}

	// Pick a fallback stage (first stage of the "best" remaining pipeline).
	fallbackPipelineID := ""
	if err2 := tx.QueryRow(`SELECT id FROM pipelines WHERE id <> ? ORDER BY is_default DESC, created_at DESC LIMIT 1;`, pipelineID).Scan(&fallbackPipelineID); err2 != nil {
		if err2 != sql.ErrNoRows {
			err = err2
			return err
		}
	}
	fallbackStageID := ""
	if fallbackPipelineID != "" {
		if err2 := tx.QueryRow(`SELECT id FROM pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC LIMIT 1;`, fallbackPipelineID).Scan(&fallbackStageID); err2 != nil {
			if err2 != sql.ErrNoRows {
				err = err2
				return err
			}
		}
	}

	// Reassign deals from stages in this pipeline.
	if fallbackStageID != "" {
		if _, err = tx.Exec(
			`UPDATE deals SET pipeline_stage_id = ? WHERE pipeline_stage_id IN (SELECT id FROM pipeline_stages WHERE pipeline_id = ?);`,
			fallbackStageID,
			pipelineID,
		); err != nil {
			return err
		}
	} else {
		if _, err = tx.Exec(
			`UPDATE deals SET pipeline_stage_id = '' WHERE pipeline_stage_id IN (SELECT id FROM pipeline_stages WHERE pipeline_id = ?);`,
			pipelineID,
		); err != nil {
			return err
		}
	}

	if _, err = tx.Exec(`DELETE FROM pipeline_stages WHERE pipeline_id = ?;`, pipelineID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM pipelines WHERE id = ?;`, pipelineID); err != nil {
		return err
	}

	// If we deleted the default pipeline, promote the fallback (if any).
	if wasDefault != 0 && fallbackPipelineID != "" {
		if _, err = tx.Exec(`UPDATE pipelines SET is_default = 0 WHERE id <> ?;`, fallbackPipelineID); err != nil {
			return err
		}
		if _, err = tx.Exec(`UPDATE pipelines SET is_default = 1 WHERE id = ?;`, fallbackPipelineID); err != nil {
			return err
		}
	}

	// Ensure there is always a default pipeline when any pipelines exist.
	var defaultCount int
	if err = tx.QueryRow(`SELECT COUNT(*) FROM pipelines WHERE is_default = 1;`).Scan(&defaultCount); err != nil {
		return err
	}
	if defaultCount == 0 {
		_, _ = tx.Exec(`UPDATE pipelines SET is_default = 0;`)
		_, _ = tx.Exec(`UPDATE pipelines SET is_default = 1 WHERE id = (SELECT id FROM pipelines ORDER BY created_at DESC LIMIT 1);`)
	}

	err = tx.Commit()
	return err
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

func (s *Store) DeletePipelineStage(stageID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var pipelineID string
	if err = tx.QueryRow(`SELECT pipeline_id FROM pipeline_stages WHERE id = ? LIMIT 1;`, stageID).Scan(&pipelineID); err != nil {
		if err == sql.ErrNoRows {
			err = tx.Commit()
			return err
		}
		return err
	}

	fallbackStageID := ""
	if err2 := tx.QueryRow(
		`SELECT id FROM pipeline_stages WHERE pipeline_id = ? AND id <> ? ORDER BY position ASC LIMIT 1;`,
		pipelineID,
		stageID,
	).Scan(&fallbackStageID); err2 != nil && err2 != sql.ErrNoRows {
		err = err2
		return err
	}

	if fallbackStageID != "" {
		if _, err = tx.Exec(`UPDATE deals SET pipeline_stage_id = ? WHERE pipeline_stage_id = ?;`, fallbackStageID, stageID); err != nil {
			return err
		}
	} else {
		if _, err = tx.Exec(`UPDATE deals SET pipeline_stage_id = '' WHERE pipeline_stage_id = ?;`, stageID); err != nil {
			return err
		}
	}

	if _, err = tx.Exec(`DELETE FROM pipeline_stages WHERE id = ?;`, stageID); err != nil {
		return err
	}
	err = tx.Commit()
	return err
}
