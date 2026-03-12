/**
 * NewsWave — config.js
 * ─────────────────────────────────────────────────────────
 *  ⚠️  Replace YOUR_API_KEY with a free key from newsapi.org
 * ─────────────────────────────────────────────────────────
 */

const CONFIG = {
  apiKey: 'YOUR_API_KEY',           // ← paste your key here
  baseUrl: 'https://newsapi.org/v2',
  pageSize: 12,
  defaultCountry: 'us',
  defaultCategory: 'general',
  maxBookmarks: 50,
};

// Available categories
const CATEGORIES = [
  { id: 'general',       label: 'Top',           icon: '⚡' },
  { id: 'technology',    label: 'Tech',           icon: '💻' },
  { id: 'business',      label: 'Business',       icon: '📈' },
  { id: 'science',       label: 'Science',        icon: '🔬' },
  { id: 'sports',        label: 'Sports',         icon: '⚽' },
  { id: 'health',        label: 'Health',         icon: '🩺' },
  { id: 'entertainment', label: 'Culture',        icon: '🎬' },
];

// Country options for country selector
const COUNTRIES = [
  { code: 'us', label: '🇺🇸 United States' },
  { code: 'gb', label: '🇬🇧 United Kingdom' },
  { code: 'in', label: '🇮🇳 India'          },
  { code: 'au', label: '🇦🇺 Australia'      },
  { code: 'ca', label: '🇨🇦 Canada'         },
  { code: 'de', label: '🇩🇪 Germany'        },
  { code: 'fr', label: '🇫🇷 France'         },
  { code: 'jp', label: '🇯🇵 Japan'          },
  { code: 'br', label: '🇧🇷 Brazil'         },
  { code: 'za', label: '🇿🇦 South Africa'   },
];
