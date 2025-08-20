import requests
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# --- Pydantic Models for Data Validation ---
class PlayerData(BaseModel):
    Name: str
    Eigenes_Rathaus: Optional[int] = None
    Tag1_Rathaus_Gegner: Optional[int] = None; Tag2_Rathaus_Gegner: Optional[int] = None; Tag3_Rathaus_Gegner: Optional[int] = None; Tag4_Rathaus_Gegner: Optional[int] = None; Tag5_Rathaus_Gegner: Optional[int] = None; Tag6_Rathaus_Gegner: Optional[int] = None; Tag7_Rathaus_Gegner: Optional[int] = None
    Tag1_Sterne: Optional[int] = None; Tag2_Sterne: Optional[int] = None; Tag3_Sterne: Optional[int] = None; Tag4_Sterne: Optional[int] = None; Tag5_Sterne: Optional[int] = None; Tag6_Sterne: Optional[int] = None; Tag7_Sterne: Optional[int] = None
    Tag1_Prozent: Optional[int] = None; Tag2_Prozent: Optional[int] = None; Tag3_Prozent: Optional[int] = None; Tag4_Prozent: Optional[int] = None; Tag5_Prozent: Optional[int] = None; Tag6_Prozent: Optional[int] = None; Tag7_Prozent: Optional[int] = None

class CalculationRequest(BaseModel):
    data: List[PlayerData]
    point_system: dict

# --- App Setup ---
app = FastAPI()
COC_API_BASE_URL = "https://api.clashofclans.com/v1"

# Allow CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Function ---
def calculate_all_points(df, point_system):
    if df.empty: return pd.DataFrame(columns=["Name", "Punkte"])
    df_calc = df.copy()
    total_points = pd.Series(0, index=df_calc.index, dtype=float)
    total_attacks = pd.Series(0, index=df_calc.index, dtype=int)
    df_calc['Eigenes_Rathaus'] = pd.to_numeric(df_calc['Eigenes_Rathaus'], errors='coerce').fillna(0)
    for i in range(1, 8):
        stars, pct, opp_rh = (pd.to_numeric(df_calc.get(c), errors='coerce') for c in [f"Tag{i}_Sterne", f"Tag{i}_Prozent", f"Tag{i}_Rathaus_Gegner"])
        attack_made = (stars.notna() | pct.notna()) & opp_rh.notna()
        total_attacks += attack_made.astype(int)
        stars = stars.fillna(-1); pct = pct.fillna(0)
        diff = opp_rh - df_calc['Eigenes_Rathaus']
        
        ell_conditions = [diff >= 2, diff == 1, diff == 0, diff == -1, diff <= -2]
        ell_choices = [point_system["ell_gt_2"], point_system["ell_eq_1"], point_system["ell_eq_0"], point_system["ell_eq_-1"], point_system["ell_lt_-2"]]
        ell_points = np.select(ell_conditions, ell_choices, default=0)

        attack_conditions = [
            (stars == 3) & (diff >= 2), (stars == 3) & (diff.between(-1, 1)), (stars == 3) & (diff <= -2),
            (stars == 2) & (pct >= 90), (stars == 2) & (pct.between(80, 89)), (stars == 2) & (pct.between(50, 79)),
            (stars == 1) & (pct.between(90, 99)), (stars == 1) & (pct.between(50, 89)),]
        attack_choices = [
            point_system["atk_3s_gt_2"], point_system["atk_3s_eq"], point_system["atk_3s_lt_-2"],
            point_system["atk_2s_ge_90"], point_system["atk_2s_80_89"], point_system["atk_2s_50_79"],
            point_system["atk_1s_90_99"], point_system["atk_1s_50_89"]]
        attack_points = np.select(attack_conditions, attack_choices, default=0)

        aktiv_points = np.where(attack_made, point_system["aktiv"], 0)
        bonus_100_points = np.where((pct == 100) & (diff >= 0), point_system["bonus_100"], 0)
        courage_conditions = [(diff >= 3) & (pct.between(30, 49)), (diff >= 3)]
        courage_choices = [point_system["mut_extra"], point_system["mut_base"]]
        mut_points = np.select(courage_conditions, courage_choices, default=0)
        
        daily_total = ell_points + attack_points + aktiv_points + bonus_100_points + mut_points
        total_points += np.where(attack_made, daily_total, 0)
        
    total_points += np.where(total_attacks >= 7, point_system["all_attacks"], 0)
    results = pd.DataFrame({"Name": df_calc["Name"], "Punkte": total_points.astype(int)})
    return results.sort_values(by=["Punkte", "Name"], ascending=[False, True]).reset_index(drop=True)

# --- API Endpoints ---
def make_api_request(url: str, headers: dict):
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as err:
        status_code = err.response.status_code
        if status_code == 403: raise HTTPException(status_code=403, detail="Ungültiger API-Schlüssel oder IP-Adresse nicht autorisiert.")
        elif status_code == 404: raise HTTPException(status_code=404, detail="Clan oder Krieg nicht gefunden.")
        else: raise HTTPException(status_code=status_code, detail=f"API Fehler: {err.response.text}")
    except requests.exceptions.RequestException as err:
        raise HTTPException(status_code=500, detail=f"Netzwerkfehler: {err}")

@app.get("/clan/{clan_tag}/cwl_data")
def get_cwl_data(clan_tag: str, authorization: str = Header(...)):
    formatted_tag = clan_tag.replace("#", "%23")
    headers = {"Authorization": authorization}
    
    group_data = make_api_request(f"{COC_API_BASE_URL}/clans/{formatted_tag}/warleague/group", headers)
    if group_data.get("state") != "inWar":
        raise HTTPException(status_code=404, detail="Clan befindet sich nicht in einer Clankriegsliga.")

    war_tags = [war['warTag'] for round_data in group_data.get('rounds', []) for war in round_data['warTags'] if war['warTag'] != '#0']

    all_war_data = [make_api_request(f"{COC_API_BASE_URL}/clanwarleagues/wars/{tag.replace('#', '%23')}", headers) for tag in war_tags]

    player_stats = {}
    
    for day_index, war_data in enumerate(all_war_data):
        our_clan_data = war_data.get('clan') if war_data.get('clan', {}).get('tag') == clan_tag else war_data.get('opponent')
        opponent_clan_data = war_data.get('opponent') if war_data.get('clan', {}).get('tag') == clan_tag else war_data.get('clan')

        for member in our_clan_data.get('members', []):
            player_name = member['name']
            if player_name not in player_stats:
                player_stats[player_name] = {"Name": player_name, "Eigenes_Rathaus": member.get('townhallLevel')}

            best_attack = None
            if 'attacks' in member:
                for attack in member['attacks']:
                    if not best_attack or attack['stars'] > best_attack['stars'] or (attack['stars'] == best_attack['stars'] and attack['destructionPercentage'] > best_attack['destructionPercentage']):
                        best_attack = attack
            
            if best_attack:
                opponent_tag = best_attack['defenderTag']
                opponent_info = next((opp for opp in opponent_clan_data.get('members', []) if opp['tag'] == opponent_tag), None)
                
                player_stats[player_name][f"Tag{day_index + 1}_Sterne"] = best_attack['stars']
                player_stats[player_name][f"Tag{day_index + 1}_Prozent"] = best_attack['destructionPercentage']
                if opponent_info:
                    player_stats[player_name][f"Tag{day_index + 1}_Rathaus_Gegner"] = opponent_info.get('townhallLevel')

    final_player_list = [data for name, data in player_stats.items() if any(f"Tag{i}_Sterne" in data for i in range(1, 8))]
    return final_player_list

@app.post("/calculate_points")
def calculate_points_endpoint(request: CalculationRequest):
    try:
        data_dict_list = [p.dict() for p in request.data]
        input_df = pd.DataFrame(data_dict_list)
        results_df = calculate_all_points(input_df, request.point_system)
        return results_df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ein interner Fehler ist bei der Berechnung aufgetreten: {e}")