export interface Producto {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precioIndividual: number;
  precioCombo?: number | null;
  imagen: string;
}

export interface CategoriasMenu {
  [key: string]: Producto[];
}
