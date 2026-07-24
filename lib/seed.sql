-- 初始白名單成員。之後要新增成員，直接對 allowed_users 表下 INSERT 即可，不需重新部署。
INSERT INTO allowed_users (email) VALUES
  ('stanleyliang1222@gmail.com'),
  ('zoeychueh22@gmail.com'),
  ('michecho89@gmail.com'),
  ('meiyu0129@gmail.com'),
  ('carolchueh@gmail.com')
ON CONFLICT (email) DO NOTHING;
