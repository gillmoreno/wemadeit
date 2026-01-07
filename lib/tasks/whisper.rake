namespace :whisper do
  desc "Download Whisper model for local transcription"
  task download: :environment do
    model = ENV.fetch("MODEL", Ai::WhisperConfig.model_name)

    puts "Downloading Whisper model: #{model}"

    models_dir = Rails.root.join("storage", "whisper_models")
    FileUtils.mkdir_p(models_dir)

    model_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-#{model}.bin"
    output_path = models_dir.join("ggml-#{model}.bin")

    if File.exist?(output_path)
      puts "Model already exists at #{output_path}"
      puts "Delete it first if you want to re-download."
      exit 0
    end

    puts "Downloading from: #{model_url}"
    puts "This may take a few minutes..."

    success = system("curl", "-L", "--progress-bar", "-o", output_path.to_s, model_url)

    if success && File.exist?(output_path)
      size_mb = (File.size(output_path) / 1024.0 / 1024.0).round(1)
      puts "Model downloaded successfully: #{output_path} (#{size_mb} MB)"
    else
      abort("Download failed! Check your internet connection.")
    end
  end

  desc "Check Whisper configuration status"
  task status: :environment do
    puts "Whisper Configuration Status"
    puts "=" * 40
    puts "Enabled:      #{Ai::WhisperConfig.enabled?}"
    puts "Binary:       #{Ai::WhisperConfig.binary_path}"
    puts "Binary found: #{Ai::WhisperConfig.binary_exists?}"
    puts "Model:        #{Ai::WhisperConfig.model_name}"
    puts "Model path:   #{Ai::WhisperConfig.model_path}"
    puts "Model found:  #{Ai::WhisperConfig.model_exists?}"
    puts "Threads:      #{Ai::WhisperConfig.threads}"
    puts "=" * 40
    puts "Available:    #{Ai::WhisperConfig.available?}"

    unless Ai::WhisperConfig.binary_exists?
      puts "\nTo install whisper-cpp:"
      puts "  brew install whisper-cpp"
    end

    unless Ai::WhisperConfig.model_exists?
      puts "\nTo download the model:"
      puts "  rake whisper:download"
    end

    if Ai::WhisperConfig.available?
      puts "\nLocal Whisper is ready for transcription!"
    end
  end

  desc "List available Whisper models"
  task models: :environment do
    puts "Available Whisper Models"
    puts "=" * 50
    puts "Model      | Size    | RAM    | Quality"
    puts "-" * 50
    puts "tiny       | 75 MB   | ~1 GB  | Fast, lower accuracy"
    puts "base       | 142 MB  | ~1.5GB | Good for short audio"
    puts "small      | 466 MB  | ~2.5GB | Recommended for Italian"
    puts "medium     | 1.5 GB  | ~5 GB  | Higher accuracy"
    puts "large-v3   | 3 GB    | ~10 GB | Best accuracy"
    puts "=" * 50
    puts "\nDownload a model:"
    puts "  rake whisper:download MODEL=small"
  end
end
