# SEND

SEND is an interactive financial education platform centered around a node-based strategy editor. Users can build trading logic as graphs, test strategies against historical market data, and work through guided learning modules that teach both the platform and core investing concepts.

A working demo is available at [sendsys.io](https://sendsys.io).

## Features

- Node-based editor for building trading strategies as graphs
- Historical backtesting over past market data
- Replay tools for reviewing daily strategy behavior, trades, and portfolio changes
- Interactive learning modules with guided practice
- Frontend, backend, and execution engine packaged for Docker-based local development

## Tech Stack

- Frontend: React
- Backend API: Spring / Java
- Execution engine: OCaml
- Reverse proxy: Nginx
- Authentication: Supabase
- Local runtime: Docker Compose

## Getting Started

### Prerequisites

- Docker
- A Supabase project for authentication configuration
- csv files with historical data (NOT PROVIDED!!)

### Required Local Files

Before starting the app, make sure your project root includes:

- A `/data` directory
- CSV files with the structure shown below
- A `.env` file with the required environment variables

**Required CSV files and titles for the Java backend**

`us-balance-quarterly.csv`

```text
ticker;currency;fiscal_year;fiscal_period;report_date;publish_date;restated_date;shares_basic;shares_diluted;cash_and_st_investments;accounts_notes_receivables;inventories;total_current_assets;ppe_net;lt_investments_receivables;other_lt_assets;total_noncurrent_assets;total_assets;payables_accruals;st_debt;total_current_liabilities;lt_debt;total_noncurrent_liabilities;total_liabilities;share_capital_apic;treasury_stock;retained_earnings;total_equity;total_liabilities_equity
```

`us-cashflow-quarterly.csv`

```text
ticker;currency;fiscal_year;fiscal_period;report_date;publish_date;restated_date;cf_net_income_starting_line;cf_da;change_in_fixed_assets_intangibles;change_in_working_capital;change_in_accounts_receivable;change_in_inventories;change_in_accounts_payable;change_in_other;net_cash_operating_activities;change_fixed_assets_intangibles;net_change_lti;net_cash_acquisitions_divestitures;net_cash_investing_activities;dividends_paid;repayment_of_debt;repurchase_of_equity;net_cash_financing_activities;net_change_cash
```

`us-companies.csv`

```text
ticker;company_name;industry_id;ISIN;fiscal_year_end_month;number_employees;business_summary;market;CIK;main_currency
```

`us-income-quarterly.csv`

```text
ticker;currency;fiscal_year;fiscal_period;report_date;publish_date;restated_date;revenue;cost_of_revenue;sga;research_and_development;income_da;interest_expense_net;abnormal_gains;income_tax_net;extraordinary_gains_losses;net_income
```

`us-shareprices-daily.csv`

```text
ticker;price_date;open;high;low;close;adj_close;volume;dividend;shares_outstanding
```

### Environment Variables

Set the following variables in your `.env` file:

- `SEND_DB_PASSWORD`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (recommended for SEO metadata and canonical URLs)
- `APP_AUTH_SUPABASE_ISSUER_URI`
- `APP_AUTH_SUPABASE_JWK_SET_URI` or `APP_AUTH_SUPABASE_JWT_SECRET`
- `APP_LECTURES_PROGRESS_COOKIE_SECRET`
- `APP_ANALYTICS_UMAMI_SCRIPT_URI` (optional, required if below variable is set)
- `APP_ANALYTICS_UMAMI_WEBSITE_ID` (optional, required if above variable is set)
- `APP_AUTH_SUPABASE_AUDIENCE` (optional)

Notes:

- If your Supabase project uses legacy `HS256` signing, set `APP_AUTH_SUPABASE_JWT_SECRET` and leave `APP_AUTH_SUPABASE_JWK_SET_URI` empty.
- If your Supabase project uses asymmetric signing, set `APP_AUTH_SUPABASE_JWK_SET_URI` and leave `APP_AUTH_SUPABASE_JWT_SECRET` empty.
- `APP_ANALYTICS_UMAMI_SCRIPT_URI` should point to the Umami tracker script URL that is reachable from the backend container, for example `http://umami:3000/script.js` on a shared Docker network.
- `APP_ANALYTICS_UMAMI_WEBSITE_ID` should match the Umami site identifier for this deployment.
- If Umami is not configured and you don't need it, leave those variables blank.
- If you use Umami, set `COLLECT_API_ENDPOINT=/api/analytics/collect` in environment variables for that container
- In Docker Compose, `VITE_API_URL` should usually be left empty because the frontend uses the bundled Nginx proxy.
- `VITE_SITE_URL` should be set to the public site origin, for example `https://sendsys.io`, so the frontend can generate correct canonical and social image URLs.

## Setup

1. Clone the repository.
2. Create a `.env` file in the project root and add the required variables.
3. Create a `data` directory with csv data.
4. In the project root, build and start the container:

```bash
docker compose up --build
```

OR

```bash
docker compose build send-back
docker compose build send-front
docker compose up
```

If you would like to build and run seperately.

By default, the frontend is exposed on `http://127.0.0.1:5173`.

## Architecture

The application flow is:

`Frontend (React) -> Backend API (Spring Java) -> Execution Engine (OCaml)`

Nginx routes frontend traffic and proxies `/api` requests to the backend. The backend coordinates with the OCaml execution engine to run strategies and return results to the frontend.

## Notes

- Docker Compose is the supported local development path.
- The backend and database stay on the internal Docker network by default.
- Plain local runs outside Docker are not supported by default unless the same environment variables are exported manually.

## Disclaimer

Hackonomics is an educational platform. It does not provide investment advice, and any real-money trading decisions are made at the user's own risk.
