export interface Producto {
    nombre: string;
    descripcion: string;
    precioIndividual: number;
    precioCombo?: number;
    imagen: string;
  }
  
  export interface CategoriasMenu {
    [categoria: string]: Producto[];
  }
  
  export const MENU_PORTAL: CategoriasMenu = {
    "Hamburguesas": [
      {
        nombre: "HAMBURGUESA PORTAL",
        descripcion: "150 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla.",
        precioIndividual: 18000,
        precioCombo: 27800,
        imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60"
      },
      {
        nombre: "HAMBURGUESA PORTAZO",
        descripcion: "Dos carnes de 150 gramos artesanal, doble queso, tocineta, lechuga, tomate, cebolla.",
        precioIndividual: 28000,
        precioCombo: 37800,
        imagen: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500&auto=format&fit=crop&q=60"
      },
      {
        nombre: "HAMBURGUESA RANCHERA",
        descripcion: "150 gramos de carne artesanal, salchicha ranchera, salsa BBQ, maicitos, queso, tocineta, tomate, lechuga, cebolla.",
        precioIndividual: 22500,
        precioCombo: 32300,
        imagen: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&auto=format&fit=crop&q=60"
      },
      {
        nombre: "AREPA BURGUER",
        descripcion: "150 gramos de carne artesanal, queso, tocineta, cebolla, salsa BBQ, tomate, tajada de plátano maduro, arepa asada al carbón.",
        precioIndividual: 19000,
        precioCombo: 28800,
        imagen: "https://images.unsplash.com/photo-1629115911440-e9690f61253d?w=500&auto=format&fit=crop&q=60"
      }
    ],
    "Perros y Sándwiches": [
      {
        nombre: "PERRO PORTAL",
        descripcion: "Salchicha Zenú tipo americano, doble queso, tocineta, cebolla, papa fosforito, pan artesanal, salsa tártara de la casa.",
        precioIndividual: 14500,
        precioCombo: 24300,
        imagen: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=500&auto=format&fit=crop&q=60"
      },
      {
        nombre: "SANDWICH NORTEÑO",
        descripcion: "Carne desmechada con salsa de la casa un toque picante, pan, queso, lechuga, tomate y salsa de ajo Portal.",
        precioIndividual: 14500,
        precioCombo: 24300,
        imagen: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=60"
      }
    ],
    "Papas y Especiales": [
      {
        nombre: "SALCHIPAPA PORTAL",
        descripcion: "150 gr de papa a la francesa rizada, 90 gr de carne desmechada, 90 gr de pechuga de pollo, salchicha extra larga Colanta, salsas de la casa, gratinada con queso mozzarella.",
        precioIndividual: 24500,
        imagen: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=500&auto=format&fit=crop&q=60"
      }
    ]
  };