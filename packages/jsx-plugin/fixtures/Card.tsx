import cardCss from "./card.css?raw";

const local = ".local{background:url(https://cdn.example/local.png)}";
const plain = `.plain{font-family:url(https://cdn.example/font.woff);content:"\\"}`;
const live = ".live{color:blue}";
var old = ".old{color:green}";
let assigned = ".assigned{color:red}";
let sum = ".sum{color:red}";
var moduleSheet = ".module{color:red}";
const alias = live;

export function setSheet(next: string) {
	moduleSheet = next;
}

export function Card(props: { image: string; cardCss: string }) {
	assigned = props.cardCss;
	sum += props.cardCss;
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
			<style>{live}</style>
			<style>{old}</style>
			<style>{assigned}</style>
			<style>{sum}</style>
			<style>{moduleSheet}</style>
			<style>{alias}</style>
		</div>
	);
}
