/** Tailwind config customised for a luxury / elegant theme */
const plugin = require('daisyui');

module.exports = {
	content: [
		'./views/**/*.ejs',
		'./public/js/**/*.js',
		'./index.js'
	],
	theme: {
		extend: {
			colors: {
				gold: {
					DEFAULT: '#bfa06e',
					700: '#a8864d',
					900: '#8b6e3d'
				},
				navy: {
					DEFAULT: '#0b0f1a',
					700: '#070812'
				}
			},
			fontFamily: {
				sans: ['Inter', 'ui-sans-serif', 'system-ui'],
				serif: ["Playfair Display", 'serif']
			}
		}
	},
	plugins: [require('daisyui')],
	daisyui: {
		themes: [
			{
				elegant: {
					'primary': '#bfa06e',
					'primary-content': '#0b0f1a',
					'neutral': '#0b0f1a',
					'base-100': '#fbfbfb',
					'base-200': '#f3f3f3',
					'base-300': '#eaeaea',
					'accent': '#8b6e3d',
					'accent-content': '#ffffff'
				}
			}
		]
	}
};

