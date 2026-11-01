import { initDb } from '../server/db.js';

const db = initDb();
const byDate = db.prepare(`
  SELECT date_local,
         COUNT(*) as total,
         SUM(CASE WHEN image_url IS NOT NULL AND length(image_url) > 0 THEN 1 ELSE 0 END) as with_img,
         SUM(CASE WHEN image_url IS NULL OR length(image_url) = 0 THEN 1 ELSE 0 END) as without_img
  FROM articles
  GROUP BY date_local
  HAVING without_img > 0
  ORDER BY date_local DESC
`).all();
console.table(byDate);
