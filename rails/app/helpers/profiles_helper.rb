module ProfilesHelper
  EMOJI_CHOICES = %w[
    🦁 🐯 🐼 🦊 🐸 🐙 🦅 🐺
    🦈 🐲 🦄 🐢 🐝 🦖 🐧 🦉
    👑 🚀 ⚡ 🔥 🌟 🎯 🍺 🥤
  ].freeze

  PROVIDER_LABELS = { "twitter" => "𝕏", "github" => "GitHub", "oidc" => "OIDC" }.freeze

  def emoji_choices
    EMOJI_CHOICES
  end

  def provider_label(provider)
    PROVIDER_LABELS.fetch(provider, provider)
  end
end
