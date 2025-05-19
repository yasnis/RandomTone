/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'dialogAppear': 'dialogAppear 0.3s ease-out',
        'appear': 'appear 0.4s ease-out',
      },
      keyframes: {
        dialogAppear: {
          '0%': { transform: 'translate(-50%, -60%) scale(0.95)', opacity: '0' },
          '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '1' },
        },
        appear: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  corePlugins: {
    backgroundColor: true,
    textColor: true,
    padding: true,
    margin: true,
    display: true,
    flexDirection: true,
    gap: true,
    borderRadius: true,
  },
  // 高度なJITモードを有効化
  future: {
    hoverOnlyWhenSupported: true,
  },
  experimental: {
    optimizeUniversalDefaults: true,
  },
  plugins: [],
}