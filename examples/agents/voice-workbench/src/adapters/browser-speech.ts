import type { SpeechDeliveryPort, WorkbenchDisposable } from "../ports";

export const isBrowserSpeechDeliverySupported = (): boolean =>
	typeof globalThis.speechSynthesis?.speak === "function" &&
	typeof globalThis.SpeechSynthesisUtterance !== "undefined";

export const createBrowserSpeechDeliveryPort = (): SpeechDeliveryPort => {
	let active: WorkbenchDisposable | null = null;

	return (request, emit) => {
		if (request.type === "mute") {
			emit({ type: "MUTED", attemptId: request.attemptId });
			return;
		}
		if (request.type === "unavailable") {
			emit({ type: "UNAVAILABLE", attemptId: request.attemptId });
			return;
		}
		if (request.type === "cancel" || request.type === "dispose") {
			active?.dispose();
			active = null;
			globalThis.speechSynthesis?.cancel();
			return;
		}
		if (!isBrowserSpeechDeliverySupported()) {
			emit({ type: "UNAVAILABLE", attemptId: request.attemptId });
			return;
		}

		let disposed = false;
		const utterance = new SpeechSynthesisUtterance(request.text);
		utterance.onend = () => {
			if (!disposed) emit({ type: "DELIVERED", attemptId: request.attemptId });
		};
		utterance.onerror = (event) => {
			if (!disposed) {
				emit({
					type: "FAIL",
					attemptId: request.attemptId,
					message: event.error || "Speech delivery failed.",
				});
			}
		};
		const effect: WorkbenchDisposable = {
			dispose() {
				if (disposed) return;
				disposed = true;
				utterance.onend = null;
				utterance.onerror = null;
				globalThis.speechSynthesis?.cancel();
			},
		};
		active?.dispose();
		active = effect;
		try {
			globalThis.speechSynthesis.speak(utterance);
			emit({ type: "QUEUED", attemptId: request.attemptId });
		} catch {
			emit({
				type: "FAIL",
				attemptId: request.attemptId,
				message: "Speech delivery failed.",
			});
		}
		return effect;
	};
};
