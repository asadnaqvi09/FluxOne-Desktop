-- Employee email for profile display / self-edit
ALTER TABLE employees ADD COLUMN email TEXT;

UPDATE employees SET email = 'fatima@softwareflux.com' WHERE id = 'CSH-102';
UPDATE employees SET email = 'admin@softwareflux.com' WHERE id = 'ADM-001';
UPDATE employees SET email = 'supervisor@softwareflux.com' WHERE id = 'SUP-001';
