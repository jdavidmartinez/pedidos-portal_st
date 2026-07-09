// app/menu/data.ts
import { menuData } from '../../data/menu'; // Importamos la base de datos maestra de Portal St

export interface Producto {
  nombre: string;
  descripcion: string;
  precioIndividual: number;
  precioCombo?: number;
  imagen: string;
}

export interface CategoriasMenu {
  [key: string]: Producto[];
}

// Adaptador de imágenes por defecto para la base de datos cruda que carece de URLs de ilustración
const imgFallback = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600";

/* 
  UNIFICACIÓN ARQUITECTÓNICA:
  Agrupamos los arreglos separados de data/menu.ts dentro de las 3 pestañas 
  comerciales visibles en tu frontend sin duplicar información.
*/
export const MENU_PORTAL: CategoriasMenu = {
  "Hamburguesas": [
    ...menuData.hamburguesas.map(p => ({
      nombre: p.name,
      descripcion: p.description || "Deliciosa hamburguesa artesanal a la parrilla.",
      precioIndividual: 18000, // Precios base vinculados temporalmente
      imagen: imgFallback
    })),
    ...menuData.hamburguesasMixtas.map(p => ({
      nombre: p.name,
      descripcion: "Combinación especial de sabores de la casa.",
      precioIndividual: 26500,
      imagen: imgFallback
    }))
  ],
  
  "Perros y Sándwiches": [
    ...menuData.perros.map(p => ({
      nombre: p.name,
      descripcion: p.description || "Estilo urbano con la mejor sazón.",
      precioIndividual: 14500,
      imagen: imgFallback
    })),
    ...menuData.sandwich.map(p => ({
      nombre: p.name,
      descripcion: p.description || "Pan tostado con ingredientes seleccionados.",
      precioIndividual: 14500,
      imagen: imgFallback
    }))
  ],

  "Papas y Especiales": [
    ...menuData.otrasDelicias.map(p => ({
      nombre: p.name,
      descripcion: "El acompañamiento perfecto para tu antojo.",
      precioIndividual: 11800,
      imagen: imgFallback
    })),
    ...menuData.bebidas.map(p => ({
      nombre: p.name,
      descripcion: "Bebida fría para acompañar tu menú.",
      precioIndividual: 4500,
      imagen: imgFallback
    }))
  ]
};