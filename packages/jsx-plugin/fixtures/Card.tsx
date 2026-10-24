import cardCss from "./card.css?raw";

const local = ".local{background:url(https://cdn.example/local.png)}";
const plain = `.plain{font-family:url(https://cdn.example/font.woff);content:"\\"}`;

export function Card(props: { image: string; cardCss: string }) {
	return (
		<div>
			<style>
				{
					".static{background:url(https://cdn.example/static.png)} @import 'https://cdn.example/a.css';"
				}
			</style>
			<style>{local}</style>
			<style>{plain}</style>
			<style>{cardCss}</style>
			<style>{`url(${props.image})`}</style>
			<style>{props.cardCss}</style>
		</div>
	);
}
