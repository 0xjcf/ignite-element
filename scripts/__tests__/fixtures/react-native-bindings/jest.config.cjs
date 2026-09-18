module.exports = {
	preset: "react-native",
	testMatch: ["**/bindings.native.js"],
	transformIgnorePatterns: [
		"node_modules/(?!((jest-)?react-native|@react-native|ignite-element|@ignite-element|@reduxjs|redux|redux-thunk|immer|reselect|mobx)/)",
	],
};
