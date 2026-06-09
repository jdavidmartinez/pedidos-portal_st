export interface MenuItem {
    name: string;
    description?: string; // El signo '?' significa que es opcional (al some items don't have it)
    price: string;
    comboPrice?: string; // Opcional, solo para hamburguesas, perros y sándwiches
  }
  
  export interface MenuData {
    hamburguesas: MenuItem[];
    hamburguesasMixtas: MenuItem[];
    perros: MenuItem[];
    sandwich: MenuItem[];
    otrasDelicias: MenuItem[];
    bebidas: MenuItem[];
    limonadas: MenuItem[];
  }