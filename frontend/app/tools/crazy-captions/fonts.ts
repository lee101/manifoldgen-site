import {
  Anton, Archivo_Black, Bangers, Bebas_Neue, Bungee, Caveat_Brush, DM_Serif_Display, Inter, Montserrat, Orbitron, Oswald, Permanent_Marker,
  Playfair_Display, Poppins, Press_Start_2P, Rubik_Glitch, Russo_One, Space_Mono, Syne, Unbounded, VT323,
} from 'next/font/google';
import { registerFamilies } from '@/lib/captions/registry';

const anton = Anton({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const bebas = Bebas_Neue({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const archivo = Archivo_Black({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const montserrat = Montserrat({ subsets: ['latin', 'latin-ext', 'cyrillic'], display: 'swap', preload: false, style: ['normal', 'italic'] });
const poppins = Poppins({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '500', '600', '700', '800', '900'], style: ['normal', 'italic'] });
const oswald = Oswald({ subsets: ['latin', 'latin-ext', 'cyrillic'], display: 'swap', preload: false });
const russo = Russo_One({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const bangers = Bangers({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const marker = Permanent_Marker({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const pixel = Press_Start_2P({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const vt323 = VT323({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const orbitron = Orbitron({ subsets: ['latin'], display: 'swap', preload: false });
const spacemono = Space_Mono({ subsets: ['latin'], display: 'swap', preload: false, weight: ['400', '700'], style: ['normal', 'italic'] });
const syne = Syne({ subsets: ['latin', 'latin-ext'], display: 'swap', preload: false });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext', 'cyrillic'], display: 'swap', preload: false, style: ['normal', 'italic'] });
const dmserif = DM_Serif_Display({ subsets: ['latin'], display: 'swap', preload: false, weight: '400', style: ['normal', 'italic'] });
const unbounded = Unbounded({ subsets: ['latin', 'latin-ext', 'cyrillic'], display: 'swap', preload: false });
const rubikglitch = Rubik_Glitch({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const bungee = Bungee({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });
const inter = Inter({ subsets: ['latin', 'latin-ext', 'cyrillic', 'greek'], display: 'swap', preload: false, style: ['normal', 'italic'] });
const caveat = Caveat_Brush({ subsets: ['latin'], display: 'swap', preload: false, weight: '400' });

registerFamilies({
  anton: anton.style.fontFamily, bebas: bebas.style.fontFamily, archivo: archivo.style.fontFamily, montserrat: montserrat.style.fontFamily,
  poppins: poppins.style.fontFamily, oswald: oswald.style.fontFamily, russo: russo.style.fontFamily, bangers: bangers.style.fontFamily,
  marker: marker.style.fontFamily, pixel: pixel.style.fontFamily, vt323: vt323.style.fontFamily, orbitron: orbitron.style.fontFamily,
  spacemono: spacemono.style.fontFamily, syne: syne.style.fontFamily, playfair: playfair.style.fontFamily, dmserif: dmserif.style.fontFamily,
  unbounded: unbounded.style.fontFamily, rubikglitch: rubikglitch.style.fontFamily, bungee: bungee.style.fontFamily, inter: inter.style.fontFamily,
  caveat: caveat.style.fontFamily,
});
