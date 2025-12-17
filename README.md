<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# InstaConvert AI

InstaConvert AI to przegladarkowa aplikacja do szybkiej konwersji plikow WebM do MP4 (H.264/AAC) z mysla o Instagramie. Dziala lokalnie w przegladarce, bez wysylania wideo na serwer. Dodatkowo potrafi wygenerowac opis i hashtagi na podstawie tekstowego opisu wideo (Gemini).

## Do czego sluzy aplikacja
- Przygotowanie wideo WebM do publikacji w Instagramie (Reels, Stories, posty).
- Zapewnienie kompatybilnosci odtwarzania na telefonach i w serwisach spolecznosciowych.
- Praca "u siebie": plik nie opuszcza urzadzenia, wszystko dzieje sie lokalnie.
- Opcjonalnie: tworzenie gotowych captionow i hashtagow AI na podstawie krotkiego opisu.

## Najwazniejsze funkcje
- Konwersja WebM -> MP4 w przegladarce przez FFmpeg WebAssembly.
- Podglad wideo przed i po konwersji.
- Pasek postepu i statusy ladowania silnika.
- Pobieranie gotowego pliku MP4 jednym kliknieciem.
- Generator opisow i hashtagow (Gemini) uruchamiany na zyczenie.

## Jak to dziala (skrot)
1. Uzytkownik wybiera plik WebM.
2. FFmpeg WASM zapisuje plik w pamieci przegladarki i wykonuje konwersje do MP4 (libx264 + AAC).
3. Aplikacja pokazuje podglad wyniku i pozwala pobrac plik.
4. Opcjonalnie: AI generuje caption i hashtagi na podstawie tekstu.

## Prywatnosc i dane
- Wideo jest przetwarzane lokalnie w przegladarce.
- Aplikacja nie wysyla plikow na serwer.
- Do Gemini trafia tylko tekstowy opis wideo (jesli uzyjesz generatora).

## Wymagania techniczne
- Bezpieczny kontekst: HTTPS lub localhost (wymagane dla SharedArrayBuffer).
- Tryb Cross-Origin Isolated (COOP/COEP) - aplikacja to wymusza przez naglowki lub service worker.
- Nowoczesna przegladarka z WebAssembly (Chrome, Edge, Firefox).
- Polaczenie z siecia przy pierwszym uruchomieniu (pobranie FFmpeg z CDN).

## Uruchomienie lokalne
1. Zainstaluj zaleznosci: `npm install`
2. (Opcjonalnie) ustaw `API_KEY` w `.env.local`:
   `API_KEY=twoj_klucz_gemini`
3. Uruchom dev server: `npm run dev`
4. Otworz `http://localhost:5173`

## Budowanie i podglad
- Build: `npm run build`
- Podglad produkcyjny: `npm run preview`

## Hosting / produkcja
- Wymagane HTTPS.
- Ustaw naglowki:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Resource-Policy: cross-origin`
- Zostaw `public/coi-serviceworker.js`, bo automatycznie ustawia COOP/COEP tam, gdzie hosting nie pozwala na naglowki.
- Pierwsze wejscie moze odswiezyc strone - to normalne.

## Ograniczenia
- Duze pliki zuzywaja duzo RAM i moga spowolnic przegladarke.
- Pierwsze ladowanie pobiera okolo 30 MB bibliotek FFmpeg.
- Uzyty preset `ultrafast` i CRF 23 - szybkosciowo ok, ale nie jest to tryb archiwalny.

## Struktura (najwazniejsze pliki)
- `App.tsx` - glowny przeplyw UI i logika konwersji.
- `services/ffmpegService.ts` - ladowanie FFmpeg WASM i konwersja WebM -> MP4.
- `services/geminiService.ts` - generowanie caption/hashtagow w Gemini.
- `public/coi-serviceworker.js` - wymusza COOP/COEP dla SharedArrayBuffer.
- `vite.config.ts` - naglowki COOP/COEP i wstrzykniecie `API_KEY`.
