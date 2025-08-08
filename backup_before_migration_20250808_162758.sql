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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allocation_splits; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.allocation_splits (
    id text NOT NULL,
    "transactionId" text NOT NULL,
    "budgetItemId" integer NOT NULL,
    amount integer NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.allocation_splits OWNER TO nagaiku_user;

--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.budget_items (
    id integer NOT NULL,
    name text NOT NULL,
    category text,
    "budgetedAmount" integer,
    note text,
    "grantId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.budget_items OWNER TO nagaiku_user;

--
-- Name: budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.budget_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budget_items_id_seq OWNER TO nagaiku_user;

--
-- Name: budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.budget_items_id_seq OWNED BY public.budget_items.id;


--
-- Name: budget_schedules; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.budget_schedules (
    id integer NOT NULL,
    "budgetItemId" integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.budget_schedules OWNER TO nagaiku_user;

--
-- Name: budget_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.budget_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budget_schedules_id_seq OWNER TO nagaiku_user;

--
-- Name: budget_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.budget_schedules_id_seq OWNED BY public.budget_schedules.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    color text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO nagaiku_user;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO nagaiku_user;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: freee_syncs; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.freee_syncs (
    id integer NOT NULL,
    "lastSyncAt" timestamp(3) without time zone NOT NULL,
    "syncStatus" text DEFAULT 'idle'::text NOT NULL,
    "syncMessage" text,
    "recordCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.freee_syncs OWNER TO nagaiku_user;

--
-- Name: freee_syncs_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.freee_syncs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freee_syncs_id_seq OWNER TO nagaiku_user;

--
-- Name: freee_syncs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.freee_syncs_id_seq OWNED BY public.freee_syncs.id;


--
-- Name: freee_tokens; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.freee_tokens (
    id integer NOT NULL,
    "accessToken" text NOT NULL,
    "refreshToken" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "tokenType" text DEFAULT 'Bearer'::text NOT NULL,
    scope text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.freee_tokens OWNER TO nagaiku_user;

--
-- Name: freee_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.freee_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freee_tokens_id_seq OWNER TO nagaiku_user;

--
-- Name: freee_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.freee_tokens_id_seq OWNED BY public.freee_tokens.id;


--
-- Name: grants; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.grants (
    id integer NOT NULL,
    name text NOT NULL,
    "grantCode" text,
    "totalAmount" integer,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    status text DEFAULT 'in_progress'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.grants OWNER TO nagaiku_user;

--
-- Name: grants_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grants_id_seq OWNER TO nagaiku_user;

--
-- Name: grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.grants_id_seq OWNED BY public.grants.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    "journalNumber" integer NOT NULL,
    "journalLineNumber" integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    description text,
    amount integer NOT NULL,
    account text,
    supplier text,
    item text,
    memo text,
    remark text,
    department text,
    "managementNumber" text,
    "freeDealId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.transactions OWNER TO nagaiku_user;

--
-- Name: budget_items id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items ALTER COLUMN id SET DEFAULT nextval('public.budget_items_id_seq'::regclass);


--
-- Name: budget_schedules id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules ALTER COLUMN id SET DEFAULT nextval('public.budget_schedules_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: freee_syncs id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_syncs ALTER COLUMN id SET DEFAULT nextval('public.freee_syncs_id_seq'::regclass);


--
-- Name: freee_tokens id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_tokens ALTER COLUMN id SET DEFAULT nextval('public.freee_tokens_id_seq'::regclass);


--
-- Name: grants id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.grants ALTER COLUMN id SET DEFAULT nextval('public.grants_id_seq'::regclass);


--
-- Data for Name: allocation_splits; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.allocation_splits (id, "transactionId", "budgetItemId", amount, note, "createdAt", "updatedAt") FROM stdin;
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
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.transactions (id, "journalNumber", "journalLineNumber", date, description, amount, account, supplier, item, memo, remark, department, "managementNumber", "freeDealId", "createdAt", "updatedAt") FROM stdin;
tx_003	3	1	2024-08-02 00:00:00	水道光熱費	45000	管理費	電力会社	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.528	2025-08-04 14:31:37.528
tx_001	1	1	2024-08-01 00:00:00	事務用品購入	15000	事業費	オフィス用品店	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.527	2025-08-04 14:31:37.527
tx_002	2	1	2024-08-01 00:00:00	家賃	120000	管理費	不動産会社	\N	\N	\N	管理部門	\N	\N	2025-08-04 14:31:37.527	2025-08-04 14:31:37.527
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
-- Name: allocation_splits allocation_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT allocation_splits_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budget_schedules budget_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules
    ADD CONSTRAINT budget_schedules_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: freee_syncs freee_syncs_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_syncs
    ADD CONSTRAINT freee_syncs_pkey PRIMARY KEY (id);


--
-- Name: freee_tokens freee_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_tokens
    ADD CONSTRAINT freee_tokens_pkey PRIMARY KEY (id);


--
-- Name: grants grants_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: budget_schedules_budgetItemId_year_month_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX "budget_schedules_budgetItemId_year_month_key" ON public.budget_schedules USING btree ("budgetItemId", year, month);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: idx_allocation_splits_amount; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_allocation_splits_amount ON public.allocation_splits USING btree (amount);


--
-- Name: idx_allocation_splits_budget_item; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_allocation_splits_budget_item ON public.allocation_splits USING btree ("budgetItemId");


--
-- Name: idx_allocation_splits_transaction; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_allocation_splits_transaction ON public.allocation_splits USING btree ("transactionId");


--
-- Name: idx_budget_items_category; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_items_category ON public.budget_items USING btree (category) WHERE (category IS NOT NULL);


--
-- Name: idx_budget_items_grant; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_items_grant ON public.budget_items USING btree ("grantId");


--
-- Name: idx_budget_items_grant_sort; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_items_grant_sort ON public.budget_items USING btree ("grantId", "sortOrder");


--
-- Name: idx_budget_items_sort_order; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_items_sort_order ON public.budget_items USING btree ("sortOrder");


--
-- Name: idx_budget_schedules_active; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_schedules_active ON public.budget_schedules USING btree ("isActive") WHERE ("isActive" = true);


--
-- Name: idx_budget_schedules_budget_item; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_schedules_budget_item ON public.budget_schedules USING btree ("budgetItemId");


--
-- Name: idx_budget_schedules_year_month; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_schedules_year_month ON public.budget_schedules USING btree (year, month);


--
-- Name: idx_categories_sort_order; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_categories_sort_order ON public.categories USING btree ("sortOrder");


--
-- Name: idx_categories_type_active; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_categories_type_active ON public.categories USING btree (type, "isActive");


--
-- Name: idx_grants_dates; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_grants_dates ON public.grants USING btree ("startDate", "endDate") WHERE (("startDate" IS NOT NULL) AND ("endDate" IS NOT NULL));


--
-- Name: idx_grants_grant_code; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_grants_grant_code ON public.grants USING btree ("grantCode") WHERE ("grantCode" IS NOT NULL);


--
-- Name: idx_grants_status; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_grants_status ON public.grants USING btree (status);


--
-- Name: idx_transactions_account; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_account ON public.transactions USING btree (account);


--
-- Name: idx_transactions_amount; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_amount ON public.transactions USING btree (amount);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);


--
-- Name: idx_transactions_date_amount; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_date_amount ON public.transactions USING btree (date, amount);


--
-- Name: idx_transactions_date_desc; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_date_desc ON public.transactions USING btree (date DESC);


--
-- Name: idx_transactions_freedealid; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_freedealid ON public.transactions USING btree ("freeDealId") WHERE ("freeDealId" IS NOT NULL);


--
-- Name: allocation_splits allocation_splits_budgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT "allocation_splits_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES public.budget_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: allocation_splits allocation_splits_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT "allocation_splits_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: budget_items budget_items_grantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT "budget_items_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES public.grants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: budget_schedules budget_schedules_budgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules
    ADD CONSTRAINT "budget_schedules_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES public.budget_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO nagaiku_user;


--
-- PostgreSQL database dump complete
--

