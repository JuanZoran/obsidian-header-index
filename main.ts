import { Plugin } from 'obsidian';

export default class MinimalPlugin extends Plugin {
	async onload() {
		console.log('Minimal plugin loaded');
	}

	onunload() {
		console.log('Minimal plugin unloaded');
	}
}
