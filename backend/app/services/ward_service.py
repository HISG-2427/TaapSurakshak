import pandas as pd


CSV_PATH = "data/mumbai_ward_vulnerability_data.csv"

VULNERABILITY_COLUMNS = [
    "population_density_category",
    "household_density_category",
    "socially_weaker_section_category",
]

EXPOSURE_COLUMNS = [
    "marginal_workers_category",
    "illiteracy_rate_category",
    "dilapidated_household_category",
    "no_electric_connection_category",
    "untreated_water_quality_category",
    "distant_water_source_category",
]


def load_ward_data():
    return pd.read_csv(CSV_PATH)


def get_ward_risk_factors(ward_id):
    df = load_ward_data()

    ward = df[df["ward_id"] == ward_id]

    if ward.empty:
        raise ValueError(f"Ward {ward_id} not found")

    ward = ward.iloc[0]

    vulnerability = (
        ward[VULNERABILITY_COLUMNS].astype(float).sub(1).div(4).mean()
    )

    exposure = (
        ward[EXPOSURE_COLUMNS].astype(float).sub(1).div(4).mean()
    )

    return {
        "ward_id": int(ward["ward_id"]),
        "ward_name": ward["ward_name"],
        "population_2025": int(ward["population_2025"]),
        "vulnerability": float(vulnerability),
        "exposure": float(exposure),
    }
def get_all_wards():
    df = load_ward_data()

    wards = []

    for _, ward in df.iterrows():
        vulnerability = (
            ward[VULNERABILITY_COLUMNS].astype(float).sub(1).div(4).mean()
        )

        exposure = (
            ward[EXPOSURE_COLUMNS].astype(float).sub(1).div(4).mean()
        )

        wards.append({
            "ward_id": int(ward["ward_id"]),
            "ward_name": ward["ward_name"],
            "population_2025": int(ward["population_2025"]),
            "vulnerability": float(vulnerability),
            "exposure": float(exposure),
        })

    return wards