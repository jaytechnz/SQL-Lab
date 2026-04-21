// ─── Built-in Databases ───────────────────────────────────────────────────────
// Five pre-loaded databases used by DML and Combined challenges.
// Each database has:
//   id, label, description, icon, tables (for ER display), setupSQL

export const DATABASES = {

  // ── 1. Bookshop (flat file / single table) ──────────────────────────────────
  bookshop: {
    id: 'bookshop',
    label: 'Bookshop',
    description: 'A single-table flat-file database for a small bookshop.',
    icon: '📚',
    tables: ['books'],
    setupSQL: `
CREATE TABLE books (
  book_id   INTEGER PRIMARY KEY,
  title     VARCHAR(100),
  author    VARCHAR(80),
  genre     VARCHAR(30),
  price     REAL,
  stock     INTEGER
);
INSERT INTO books VALUES
  (1,  'The Great Gatsby',        'F. Scott Fitzgerald', 'Fiction',     12.99,  5),
  (2,  'To Kill a Mockingbird',   'Harper Lee',          'Fiction',      9.99,  8),
  (3,  'A Brief History of Time', 'Stephen Hawking',     'Non-Fiction', 14.99,  3),
  (4,  '1984',                    'George Orwell',       'Fiction',      8.99, 12),
  (5,  'Sapiens',                 'Yuval Noah Harari',   'Non-Fiction', 16.99,  6),
  (6,  'The Hobbit',              'J.R.R. Tolkien',      'Fantasy',     11.99,  4),
  (7,  'Dune',                    'Frank Herbert',       'Sci-Fi',      13.99,  7),
  (8,  'The Alchemist',           'Paulo Coelho',        'Fiction',     10.99,  9),
  (9,  'Cosmos',                  'Carl Sagan',          'Non-Fiction', 15.99,  2),
  (10, 'Foundation',              'Isaac Asimov',        'Sci-Fi',      12.49,  5);
`
  },

  // ── 2. Employees (flat file / single table) ──────────────────────────────────
  employees: {
    id: 'employees',
    label: 'Employees',
    description: 'A single-table database of company employees.',
    icon: '👥',
    tables: ['employees'],
    setupSQL: `
CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  name        VARCHAR(50),
  department  VARCHAR(30),
  salary      REAL,
  hire_date   DATE
);
INSERT INTO employees VALUES
  (1, 'Alice Johnson', 'Engineering', 55000, '2021-03-15'),
  (2, 'Bob Smith',     'Marketing',   42000, '2020-07-22'),
  (3, 'Carol White',   'Engineering', 62000, '2019-11-08'),
  (4, 'David Brown',   'HR',          38000, '2022-01-10'),
  (5, 'Emma Davis',    'Marketing',   45000, '2021-09-30'),
  (6, 'Frank Wilson',  'Engineering', 71000, '2018-06-14'),
  (7, 'Grace Lee',     'HR',          40000, '2022-05-20'),
  (8, 'Henry Taylor',  'Marketing',   48000, '2020-12-03');
`
  },

  // ── 3. School (relational, 3 tables) ─────────────────────────────────────────
  school: {
    id: 'school',
    label: 'School',
    description: 'A 3-table relational database: students, subjects and enrolments.',
    icon: '🏫',
    tables: ['students', 'subjects', 'enrollments'],
    setupSQL: `
CREATE TABLE students (
  student_id  INTEGER PRIMARY KEY,
  name        VARCHAR(50),
  year_group  INTEGER,
  form_class  VARCHAR(5)
);
CREATE TABLE subjects (
  subject_id   INTEGER PRIMARY KEY,
  subject_name VARCHAR(50),
  teacher      VARCHAR(50)
);
CREATE TABLE enrollments (
  enrol_id   INTEGER PRIMARY KEY,
  student_id INTEGER,
  subject_id INTEGER,
  grade      VARCHAR(2),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);
INSERT INTO students VALUES
  (1, 'Aisha Patel',    11, '11A'),
  (2, 'Ben Nguyen',     11, '11A'),
  (3, 'Chloe Martin',   12, '12B'),
  (4, 'Daniel Kim',     12, '12B'),
  (5, 'Elena Russo',    11, '11C'),
  (6, 'Felix Okafor',   12, '12A'),
  (7, 'Grace Chen',     11, '11A'),
  (8, 'Hugo Silva',     12, '12C');
INSERT INTO subjects VALUES
  (1, 'Computer Science', 'Ms Johnson'),
  (2, 'Mathematics',      'Mr Patel'),
  (3, 'Physics',          'Dr Ahmed'),
  (4, 'English',          'Mrs Clarke'),
  (5, 'Chemistry',        'Mr Brown');
INSERT INTO enrollments VALUES
  (1,  1, 1, 'A'),  (2,  1, 2, 'B'),  (3,  1, 3, 'A'),
  (4,  2, 1, 'B'),  (5,  2, 2, 'A'),  (6,  2, 4, 'C'),
  (7,  3, 1, 'A'),  (8,  3, 3, 'B'),  (9,  3, 5, 'A'),
  (10, 4, 2, 'C'),  (11, 4, 4, 'B'),  (12, 4, 5, 'B'),
  (13, 5, 1, 'A'),  (14, 5, 2, 'A'),  (15, 5, 4, 'A'),
  (16, 6, 1, 'B'),  (17, 6, 3, 'C'),  (18, 6, 5, 'A'),
  (19, 7, 1, 'A'),  (20, 7, 2, 'B'),  (21, 7, 4, 'A'),
  (22, 8, 3, 'B'),  (23, 8, 5, 'B'),  (24, 8, 1, 'A');
`
  },

  // ── 4. Library (relational, 3 tables) ────────────────────────────────────────
  library: {
    id: 'library',
    label: 'Library',
    description: 'A 3-table relational database: members, books and loans.',
    icon: '🏛️',
    tables: ['members', 'lib_books', 'loans'],
    setupSQL: `
CREATE TABLE members (
  member_id  INTEGER PRIMARY KEY,
  name       VARCHAR(50),
  email      VARCHAR(80),
  join_date  DATE
);
CREATE TABLE lib_books (
  book_id    INTEGER PRIMARY KEY,
  title      VARCHAR(100),
  author     VARCHAR(80),
  genre      VARCHAR(30),
  pub_year   INTEGER
);
CREATE TABLE loans (
  loan_id     INTEGER PRIMARY KEY,
  member_id   INTEGER,
  book_id     INTEGER,
  loan_date   DATE,
  return_date DATE,
  FOREIGN KEY (member_id) REFERENCES members(member_id),
  FOREIGN KEY (book_id)   REFERENCES lib_books(book_id)
);
INSERT INTO members VALUES
  (1, 'Priya Sharma',  'priya@mail.com',   '2022-09-01'),
  (2, 'James O''Brien','james@mail.com',   '2023-01-15'),
  (3, 'Yuki Tanaka',   'yuki@mail.com',    '2022-11-20'),
  (4, 'Maria Gonzalez','maria@mail.com',   '2023-03-08'),
  (5, 'Luca Ferrari',  'luca@mail.com',    '2023-06-12');
INSERT INTO lib_books VALUES
  (1, 'The Pragmatic Programmer', 'Hunt & Thomas',    'Technology', 1999),
  (2, 'Clean Code',               'Robert Martin',    'Technology', 2008),
  (3, 'Thinking Fast and Slow',   'Daniel Kahneman',  'Psychology', 2011),
  (4, 'The Design of Everyday Things', 'Don Norman',  'Design',     1988),
  (5, 'Guns Germs and Steel',     'Jared Diamond',    'History',    1997),
  (6, 'Atomic Habits',            'James Clear',      'Self-Help',  2018);
INSERT INTO loans VALUES
  (1, 1, 1, '2024-01-10', '2024-01-25'),
  (2, 1, 3, '2024-02-05', NULL),
  (3, 2, 2, '2024-01-20', '2024-02-03'),
  (4, 3, 4, '2024-02-12', NULL),
  (5, 4, 1, '2024-03-01', '2024-03-15'),
  (6, 5, 6, '2024-03-10', NULL),
  (7, 2, 5, '2024-03-18', NULL),
  (8, 1, 6, '2024-04-01', '2024-04-14'),
  (9, 3, 2, '2024-04-05', NULL);
`
  },

  // ── 5. Online Store (relational, 4 tables) ────────────────────────────────────
  store: {
    id: 'store',
    label: 'Online Store',
    description: 'A 4-table relational database: customers, products, orders and order items.',
    icon: '🛒',
    tables: ['customers', 'products', 'orders', 'order_items'],
    setupSQL: `
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name        VARCHAR(50),
  email       VARCHAR(80),
  country     VARCHAR(30)
);
CREATE TABLE products (
  product_id  INTEGER PRIMARY KEY,
  name        VARCHAR(80),
  category    VARCHAR(30),
  price       REAL
);
CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  customer_id INTEGER,
  order_date  DATE,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
CREATE TABLE order_items (
  item_id    INTEGER PRIMARY KEY,
  order_id   INTEGER,
  product_id INTEGER,
  quantity   INTEGER,
  FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
INSERT INTO customers VALUES
  (1, 'Alice Brown',    'alice@shop.com',  'UK'),
  (2, 'Carlos Vega',    'carlos@shop.com', 'Spain'),
  (3, 'Mei Lin',        'mei@shop.com',    'Singapore'),
  (4, 'David Osei',     'david@shop.com',  'Ghana'),
  (5, 'Sophie Lambert', 'sophie@shop.com', 'France');
INSERT INTO products VALUES
  (1,  'Laptop Pro 15',   'Electronics', 1299.99),
  (2,  'Wireless Mouse',  'Electronics',   29.99),
  (3,  'USB-C Hub',       'Electronics',   49.99),
  (4,  'Notebook A5',     'Stationery',     4.99),
  (5,  'Desk Lamp',       'Office',        34.99),
  (6,  'Python Book',     'Books',         39.99),
  (7,  'Mechanical Keyboard', 'Electronics', 89.99),
  (8,  'Monitor 27"',     'Electronics',  349.99);
INSERT INTO orders VALUES
  (1, 1, '2024-01-12'),
  (2, 2, '2024-01-20'),
  (3, 1, '2024-02-05'),
  (4, 3, '2024-02-14'),
  (5, 4, '2024-03-01'),
  (6, 5, '2024-03-08'),
  (7, 2, '2024-03-22'),
  (8, 1, '2024-04-10');
INSERT INTO order_items VALUES
  (1,  1, 1, 1), (2,  1, 2, 2), (3,  1, 4, 3),
  (4,  2, 3, 1), (5,  2, 6, 1),
  (6,  3, 7, 1), (7,  3, 5, 1),
  (8,  4, 8, 2),
  (9,  5, 2, 1), (10, 5, 4, 5),
  (11, 6, 6, 2), (12, 6, 3, 1),
  (13, 7, 1, 1),
  (14, 8, 7, 1), (15, 8, 2, 1), (16, 8, 4, 2);
`
  }
};

export function getDatabaseById(id) {
  return DATABASES[id] ?? null;
}

export const DATABASE_LIST = Object.values(DATABASES);
