UPDATE menu_products
SET image_url = 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/'
  || substring(image_url FROM '/menu-comic-images/(.+)\.png$')
  || '.webp',
  updated_at = now()
WHERE image_url ~ '^/menu-comic-images/.+\.png$';
