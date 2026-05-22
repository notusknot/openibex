declare module 'fit-file-parser' {
	type FitParserOptions = {
		force?: boolean;
		speedUnit?: 'm/s' | 'km/h' | 'mi/h';
		lengthUnit?: 'm' | 'km' | 'mi';
		temperatureUnit?: 'celsius' | 'fahrenheit';
		elapsedRecordField?: boolean;
		mode?: 'list' | 'cascade' | 'both';
	};

	export default class FitParser {
		constructor(options?: FitParserOptions);
		parse(
			data: ArrayBuffer | Uint8Array | Buffer,
			callback: (error: Error | null, fitData: any) => void
		): void;
	}
}

