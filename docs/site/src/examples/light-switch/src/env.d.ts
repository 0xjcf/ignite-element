// Vite returns the stylesheet as a string. The view places it in a style element.
declare module "*.css?raw" {
	const content: string;
	export default content;
}
