// ReaRead Configuration
// This file contains API keys for demo purposes
// In production, users should provide their own keys through the settings page

// Load from root .env file
const CONFIG = {
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
};

export default CONFIG;


// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
