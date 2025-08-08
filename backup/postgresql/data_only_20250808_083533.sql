--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: grants; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.grants (id, name, "grantCode", "totalAmount", "startDate", "endDate", status, "createdAt", "updatedAt") FROM stdin;
45	WAM補助金	WAM2025	7000000	2025-04-01 00:00:00	2026-03-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
46	つながり10	TSUNAGARI10	305213	2025-04-01 00:00:00	2026-03-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
47	むす春	MUSU_HARU	60000	2025-04-01 00:00:00	2025-05-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
48	むすファミ	MUSU_FAMI	100000	2025-04-01 00:00:00	2025-06-30 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
50	日本財団	NIPPON	470000	2025-04-01 00:00:00	2026-03-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
51	日財終了分	NIPPON_END	396469	2024-04-01 00:00:00	2025-03-31 00:00:00	completed	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
52	POPOLO	POPOLO	3183200	2025-04-01 00:00:00	2026-03-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 13:38:07.954
49	まんぷく	MANPUKU	1922280	2025-04-01 00:00:00	2026-08-31 00:00:00	in_progress	2025-08-06 13:38:07.954	2025-08-06 23:54:47.031
\.


--
-- Data for Name: budget_items; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.budget_items (id, name, category, "budgetedAmount", note, "grantId", "createdAt", "updatedAt", "sortOrder") FROM stdin;
10	消耗品費	消耗・食材	508000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
11	家賃	家賃	1141200	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
12	印刷製本費	固定	39200	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
13	光熱水費	光熱	342000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
14	雑役務費	ほか	12000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
15	謝金	謝金	132000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
16	賃金（アルバイト）	賃金	2382600	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
17	賃金（職員）	賃金	1920000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
18	通信運搬費	通信	498000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
19	保険料	保険	25000	\N	45	2025-08-06 13:38:43.562	2025-08-06 13:38:43.562	0
20	食材費	食材	216000	\N	46	2025-08-06 13:41:52.987	2025-08-06 13:41:52.987	0
21	消耗品費	消耗	89213	\N	46	2025-08-06 13:41:52.987	2025-08-06 13:41:52.987	0
22	食品購入費	食材	48000	\N	47	2025-08-06 13:41:52.997	2025-08-06 13:41:52.997	0
23	消耗品費	消耗	12000	\N	47	2025-08-06 13:41:52.997	2025-08-06 13:41:52.997	0
24	食品購入費	食材	82600	弁当❌	48	2025-08-06 13:41:52.999	2025-08-06 13:41:52.999	0
25	消耗品費	消耗	17400	食器プレート・割り箸など	48	2025-08-06 13:41:52.999	2025-08-06 13:41:52.999	0
26	食材費	食材	1488000	\N	49	2025-08-06 13:41:53.002	2025-08-06 13:41:53.002	0
27	衛生用品	消耗	200280	\N	49	2025-08-06 13:41:53.002	2025-08-06 13:41:53.002	0
28	レンタカー	レンタカー	234000	\N	49	2025-08-06 13:41:53.002	2025-08-06 13:41:53.002	0
29	学びフェス	固定	470000	\N	50	2025-08-06 13:41:53.004	2025-08-06 13:41:53.004	0
30	終了分	ほか	396469	\N	51	2025-08-06 13:41:53.005	2025-08-06 13:41:53.005	0
31	食料品費	食材	2092500	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
32	生活必需品・学用品	消耗	310500	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
33	人件費	賃金	360000	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
34	レンタカー	レンタカー	130000	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
35	ガソリン代	ほか	10200	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
36	人件費（諸謝金）	賃金	120000	\N	52	2025-08-06 13:41:53.007	2025-08-06 13:41:53.007	0
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.transactions (id, "journalNumber", "journalLineNumber", date, description, amount, account, supplier, item, memo, remark, department, "managementNumber", "freeDealId", "createdAt", "updatedAt") FROM stdin;
tx_003	3	1	2024-08-02 00:00:00	水道光熱費	45000	管理費	電力会社	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.528	2025-08-04 14:31:37.528
tx_001	1	1	2024-08-01 00:00:00	事務用品購入	15000	事業費	オフィス用品店	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.527	2025-08-04 14:31:37.527
tx_002	2	1	2024-08-01 00:00:00	家賃	120000	管理費	不動産会社	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.527	2025-08-04 14:31:37.527
\.


--
-- Data for Name: allocation_splits; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.allocation_splits (id, "transactionId", "budgetItemId", amount, note, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: budget_schedules; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.budget_schedules (id, "budgetItemId", year, month, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.categories (id, name, type, color, "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
1	事業費	transaction	#10B981	1	t	2025-08-04 14:31:37.396	2025-08-04 14:31:37.396
2	事業活動費	budget_item	#8B5CF6	3	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
3	管理費	transaction	#3B82F6	2	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
4	物件費	budget_item	#F59E0B	2	t	2025-08-04 14:31:37.396	2025-08-04 14:31:37.396
5	人件費	budget_item	#EF4444	1	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
\.


--
-- Data for Name: freee_syncs; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.freee_syncs (id, "lastSyncAt", "syncStatus", "syncMessage", "recordCount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: freee_tokens; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.freee_tokens (id, "accessToken", "refreshToken", "expiresAt", "tokenType", scope, "createdAt", "updatedAt") FROM stdin;
1	pY-oK2bbmeYzNAfsm5DbCQkKtFMc52NAcbfKPTqIyoU	oEVOMBh3mzLzusN6fLEAHDlEuipUAB7SgvLRD_8mtX8	2025-08-07 10:57:23.932	bearer	accounting:account_items:read accounting:account_items:write accounting:deals:read accounting:deals:write accounting:expense_application_templates:read accounting:expense_application_templates:write accounting:items:read accounting:items:write accounting:partners:read accounting:partners:write accounting:receipts:read accounting:reports_journals:read accounting:sections:read accounting:sections:write accounting:tags:read accounting:tags:write accounting:wallet_txns:read accounting:wallet_txns:write accounting:walletables:read default_read	2025-08-04 15:59:02.624	2025-08-07 04:57:24.443
\.


--
-- Name: budget_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.budget_items_id_seq', 36, true);


--
-- Name: budget_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.budget_schedules_id_seq', 74, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.categories_id_seq', 5, true);


--
-- Name: freee_syncs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.freee_syncs_id_seq', 1, false);


--
-- Name: freee_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.freee_tokens_id_seq', 1, true);


--
-- Name: grants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.grants_id_seq', 52, true);


--
-- PostgreSQL database dump complete
--

