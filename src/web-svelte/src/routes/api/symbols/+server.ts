import { json } from '@sveltejs/kit';
import { getSymbols } from '$lib/dataLoader';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const symbols = await getSymbols();
	return json({ symbols });
};
