-- The primary schema (`megaphone`) and the `megaphone` user are created by the
-- official image from MYSQL_DATABASE / MYSQL_USER. These are the extra schemas
-- the app opens its own connections against.

-- Test suite (phpunit.xml).
CREATE DATABASE IF NOT EXISTS `megaphone_test` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `megaphone_test`.* TO 'megaphone'@'%';

FLUSH PRIVILEGES;
