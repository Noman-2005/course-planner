import { parseCatalog } from "./catalogText.js";

// The single source of truth for the default catalog. It is parsed with the
// same parser the "Manage courses" editor uses, so the text round-trips exactly.
export const DEFAULT_TEXT = `# BSCSE | fall26

CSE 4165 | Web Programming | 3
A | Farhan Anan Himu | Sat | 08:30-11:00 | 529 - Computer Lab | 34
B | Farhan Anan Himu | Sat | 11:11-13:40 | 529 - Computer Lab | 34
C | Tasmia Binte Sogir | Sat | 14:00-16:30 | 827 - Computer Lab | 34
D | Hafijul Hoque Chowdhury | Sat | 08:30-11:00 | 827 - Computer Lab | 34
E | TBA | Sun | 08:30-11:00 | 529 - Computer Lab | 34
F | Pranta Biswas | Sun | 11:11-13:40 | 926 - Computer Lab | 34
G | Kazi Abdun Noor | Sun | 14:00-16:30 | 528 - Computer Lab | 34
H | Mahmudul Hasan | Sun | 14:00-16:30 | 529 - Computer Lab | 34
I | Mahmudul Hasan | Mon | 08:30-11:00 | 427 - Computer Lab | 34
J | Rafid Nahiyan Farabi | Mon | 11:11-13:40 | 529 - Computer Lab | 34
K | TBA | Mon | 14:00-16:30 | 528 - Computer Lab | 34
L | Farhan Anan Himu | Tue | 08:30-11:00 | 529 - Computer Lab | 34
M | Farhan Anan Himu | Tue | 11:11-13:40 | 529 - Computer Lab | 34
N | Kazi Abdun Noor | Tue | 14:00-16:30 | 727 - Computer Lab | 34
O | Mahmudul Hasan | Wed | 08:30-11:00 | 626 - Computer Lab | 34
P | Pranta Biswas | Wed | 11:11-13:40 | 926 - Computer Lab | 34
Q | Sayem Shahad | Wed | 14:00-16:30 | 530 - Computer Lab | 34
R | Sayem Shahad | Wed | 08:30-11:00 | 727 - Computer Lab | 34

CSE 3521 | Database Management Systems | 3
A | Didarul Islam Didar | Sat Tue | 08:30-09:50 | 401 | 39
B | Mobaswirul Islam | Sat Tue | 09:51-11:10 | 330 | 39
BA | Shihab Ahmed | Sun Wed | 15:11-16:30 | 703 | 39
BB | Shihab Ahmed | Sat Tue | 08:30-09:50 | 703 | 39
C | Md. Shafqat Talukder | Sat Tue | 11:11-12:30 | 402 | 39
D | Anindya Hoque | Sat Tue | 12:31-13:50 | 401 | 39
E | Didarul Islam Didar | Sat Tue | 13:51-15:10 | 325 | 39
F | Tanmoy Bipro Das | Sat Tue | 15:11-16:30 | 324 | 39
G | Abrar Mahmud | Sun Wed | 08:30-09:50 | 330 | 39
H | Md. Shafqat Talukder | Sun Wed | 09:51-11:10 | 329 | 39
I | Md. Shafqat Talukder | Sun Wed | 11:11-12:30 | 402 | 39
J | Md. Shafqat Talukder | Sun Wed | 12:31-13:50 | 329 | 39
K | Farhan Anan Himu | Sun Wed | 13:51-15:10 | 330 | 39
L | Abrar Mahmud | Sun Wed | 15:11-16:30 | 329 | 39

CSE 3522 | Database Management Systems Laboratory | 1
A | Mohammad Johirul Islam | Sat | 08:30-11:00 | 826 - Computer Lab | 34
B | Zobaer Ibn Razzaque | Sat | 11:11-13:40 | 727 - Computer Lab | 34
BA | Didarul Islam Didar | Sat | 11:11-13:40 | 826 - Computer Lab | 34
BB | Didarul Islam Didar | Tue | 11:11-13:40 | 926 - Computer Lab | 34
C | Md. Golam Hossain | Sat | 14:00-16:30 | 529 - Computer Lab | 34
D | Zobaer Ibn Razzaque | Sat | 14:00-16:30 | 530 - Computer Lab | 34
E | Md. Golam Hossain | Sat | 11:11-13:40 | 530 - Computer Lab | 34
F | Saifullah Mahbub | Sat | 14:00-16:30 | 727 - Computer Lab | 34
G | TBA | Sun | 08:30-11:00 | 523 - Computer Lab | 34
H | Abu Bakar Fahad | Sun | 11:11-13:40 | 529 - Computer Lab | 34
I | Jerin Hasan Priya | Wed | 14:00-16:30 | 523 - Computer Lab | 34
J | Md. Enamul Haque | Mon | 08:30-11:00 | 424 - Computer Lab | 34
K | Md. Enamul Haque | Tue | 08:30-11:00 | 523 - Computer Lab | 34
L | Miftahul Sheikh | Tue | 11:11-13:40 | 523 - Computer Lab | 34
M | Jerin Hasan Priya | Tue | 14:00-16:30 | 528 - Computer Lab | 34
N | Md. Enamul Haque | Mon | 11:11-13:40 | 427 - Computer Lab | 34
O | Abu Bakar Fahad | Wed | 08:30-11:00 | 523 - Computer Lab | 34
P | Abu Bakar Fahad | Mon | 14:00-16:30 | 426 - Computer Lab | 34

EEE 2123 | Electronics | 3
A | Taki Yashir | Sat Tue | 15:11-16:30 | 403 | 39
B | Abu Shafin Mohammad Mahdee Jameel | Sat Tue | 09:51-11:10 | 432 | 39
C | Abu Shafin Mohammad Mahdee Jameel | Sat Tue | 11:11-12:30 | 432 | 39
D | Md. Abid Hossain | Sat Tue | 12:31-13:50 | 431 | 39
E | Taki Yashir | Sat Tue | 13:51-15:10 | 425 | 39
F | Sarwar Amin | Sun Wed | 08:30-09:50 | 428 | 39
G | Sarwar Amin | Sun Wed | 09:51-11:10 | 408 | 39
H | TBA | Sun Wed | 13:51-15:10 | 410 | 39
I | Sarwar Amin | Sun Wed | 12:31-13:50 | 409 | 39

GED 1005 | AI literacy and Prompt Engineering | 3
A | Nusaiba Zaman Manifa | Mon | 08:30-11:00 | 523 - Computer Lab | 34
B | Syed Abu Ammar Muhammad Zarif | Mon | 11:11-13:40 | 727 - Computer Lab | 34
C | Mahmudul Hasan | Mon | 14:00-16:30 | 530 - Computer Lab | 34
D | Rafid Nahiyan Farabi | Mon | 08:30-11:00 | 528 - Computer Lab | 34
E | Nusaiba Zaman Manifa | Mon | 11:11-13:40 | 826 - Computer Lab | 34
F | Syed Abu Ammar Muhammad Zarif | Mon | 14:00-16:30 | 626 - Computer Lab | 34
G | Md. Mehedi Hasan | Mon | 11:11-13:40 | 827 - Computer Lab | 34
H | Md. Mehedi Hasan | Mon | 14:00-16:30 | 727 - Computer Lab | 34
`;

const parsed = parseCatalog(DEFAULT_TEXT);

export const META = { program: parsed.program || "BSCSE", term: parsed.term || "fall26" };
export const CATALOG = parsed.courses;