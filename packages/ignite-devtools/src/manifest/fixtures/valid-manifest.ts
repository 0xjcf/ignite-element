import { connectionManifestSource } from "../../sources/connection.source";
import {
	DEVTOOLS_MANIFEST_VERSION,
	type DevtoolsManifest,
	defineDevtoolsManifest,
} from "../schema";
import catalog from "./catalog-build-list.json";

type CatalogFile = {
	summary: { total: number };
	components: readonly { name: string }[];
};

const buildList = catalog as CatalogFile;

export const catalogComponentNames = buildList.components.map(
	(component) => component.name,
);

export const validDevtoolsManifest: DevtoolsManifest = defineDevtoolsManifest(
	{
		version: DEVTOOLS_MANIFEST_VERSION,
		app: "ignite-devtools",
		sources: [connectionManifestSource],
		components: catalogComponentNames.map((name) => ({ id: name, name })),
	},
	{ componentNames: catalogComponentNames },
);

export const catalogComponentCount = buildList.summary.total;
