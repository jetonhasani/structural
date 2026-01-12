// src/types/google-maps.d.ts
// or global.d.ts in your project root

interface Window {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts?: any
        ) => {
          addListener: (event: string, handler: () => void) => void;
          getPlace: () => {
            formatted_address?: string;
            geometry?: {
              location?: {
                lat: () => number;
                lng: () => number;
              };
            };
          };
        };
      };
      Map?: any;
      Marker?: any;
      // Add other Google Maps APIs as needed
    };
  };
}