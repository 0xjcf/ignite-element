import { describe, expect, it, vi } from "vitest";
import { createProductPriceCapability } from "./price-capability";

describe("same-origin product-price capability", () => {
	it("sends the admitted business request and accepts sourced evidence", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						type: "success",
						ownerId: "product-pricing-price",
						toolName: "priceProducts",
						data: {
							searches: [
								{
									subject: "Bread",
									query: "provider-owned query",
									price: {
										status: "sourced",
										amount: 2.79,
										display: "$2.79",
										sourceUrl:
											"https://www.wholefoodsmarket.com/product/bread?store=10189",
									},
									results: [
										{
											title: "Organic Sourdough Bread",
											url: "https://www.wholefoodsmarket.com/product/bread?store=10189",
											description: "Official Sarasota price: $2.79 each.",
										},
									],
								},
							],
						},
						receipt: {
							provider: "whole-foods-product-pricing",
							queryCount: 0,
							sourceCount: 1,
						},
					}),
					{ status: 200 },
				),
		);
		const capability = createProductPriceCapability({ fetch: fetchMock });
		const input = {
			retailer: "Whole Foods",
			location: "Sarasota",
			items: [
				{
					subject: "Bread",
					product: "365 Organic Sourdough Bread",
					size: "24 oz loaf",
				},
			],
		};

		await expect(
			capability.run({ name: "priceProducts", input }),
		).resolves.toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						subject: "Bread",
						price: { status: "sourced", amount: 2.79 },
					},
				],
			},
			receipt: { queryCount: 0, sourceCount: 1 },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/capabilities/product-pricing",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(input),
			}),
		);
	});

	it("rejects incomplete selections before transport", async () => {
		const fetchMock = vi.fn();
		const capability = createProductPriceCapability({ fetch: fetchMock });
		await expect(
			capability.run({
				name: "priceProducts",
				input: {
					retailer: "Whole Foods",
					location: "Sarasota",
					items: [{ subject: "Bread" }],
				},
			}),
		).resolves.toMatchObject({
			type: "validation",
			issues: expect.arrayContaining([
				"items.0.product: expected a non-empty string",
			]),
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects snippet-derived prices from the product provider", async () => {
		const capability = createProductPriceCapability({
			fetch: async () =>
				new Response(
					JSON.stringify({
						type: "success",
						ownerId: "product-pricing-price",
						toolName: "priceProducts",
						data: {
							searches: [
								{
									subject: "Bread",
									query: "provider-owned query",
									results: [
										{
											title: "Unverified snippet",
											url: "https://example.com/bread",
											description: "$2.79",
										},
									],
								},
							],
						},
						receipt: {
							provider: "whole-foods-product-pricing",
							queryCount: 0,
							sourceCount: 1,
						},
					}),
					{ status: 200 },
				),
		});

		await expect(
			capability.run({
				name: "priceProducts",
				input: {
					retailer: "Whole Foods",
					location: "Sarasota",
					items: [
						{
							subject: "Bread",
							product: "365 Organic Sourdough Bread",
							size: "24 oz loaf",
						},
					],
				},
			}),
		).resolves.toMatchObject({
			type: "provider-failure",
			message: "Product pricing returned an invalid response.",
		});
	});
});
