import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';


// --- Helper Objects & Types ---
const styles: { [key: string]: CSSProperties } = {
  container: { maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '0 1rem' },
  titleBox: { background: 'linear-gradient(90deg, #8A2387, #E94057, #F27121)', color: 'white', padding: '0.7rem 2rem', borderRadius: '12px', display: 'inline-block', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '1px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid #333', textAlign: 'center', marginBottom: '2rem' },
  card: { background: '#1E1E1E', padding: '2.5rem', borderRadius: '16px', border: '1px solid #2a2a2a', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', position: 'relative' },
  label: { display: 'block', color: '#a0a0a0', marginBottom: '0.5rem', fontWeight: 600 },
  input: { width: '100%', padding: '0.75rem 1rem', backgroundColor: '#333', border: '1px solid #555', borderRadius: '8px', color: 'white', fontSize: '1rem', marginBottom: '1.5rem' },
  button: { width: '100%', padding: '0.75rem 1rem', background: 'linear-gradient(90deg, #8A2387, #E94057, #F27121)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' },
  secondaryButton: { width: '100%', padding: '0.75rem 1rem', backgroundColor: '#333', border: '1px solid #555', borderRadius: '8px', color: '#a0a0a0', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s' },
  buttonContainer: { display: 'flex', gap: '1rem', marginTop: '2rem' },
  disabledButton: { cursor: 'not-allowed', opacity: 0.5 },
  errorBox: { backgroundColor: '#4c1d1d', color: '#f8b4b4', border: '1px solid #991b1b', padding: '1rem', borderRadius: '8px', marginTop: '1.5rem', textAlign: 'center' },
  tableContainer: { overflowX: 'auto', marginTop: '1.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' },
  th: { padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #444', fontWeight: 600, color: '#a0a0a0' },
  td: { padding: '0.75rem', borderBottom: '1px solid #333' },
  tableInput: { width: '60px', padding: '0.5rem', backgroundColor: '#333', border: '1px solid #555', borderRadius: '6px', color: 'white', textAlign: 'center' },
  h5: { color: '#a0a0a0', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '1.5rem', marginBottom: '0.75rem' },
  checkboxContainer: { display: 'flex', alignItems: 'center', marginBottom: '1rem' },
  checkbox: { marginRight: '0.5rem', width: '18px', height: '18px' },
  awardCard: { backgroundColor: '#2a2a2a', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #444', height: '100%' },
  awardTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#a0a0a0' },
  awardName: { fontSize: '1.5rem', fontWeight: 700, color: '#e94057', marginTop: '0.5rem', marginBottom: '0.5rem' },
  awardScore: { fontSize: '1rem', color: '#e0e0e0' },
  hr: { border: 'none', borderTop: '1px solid #333', margin: '2rem 0' },
  settingsIcon: { position: 'absolute', top: '1rem', right: '1rem', cursor: 'pointer', fontSize: '1.5rem', color: '#a0a0a0', zIndex: 10 },
  settingsInput: { width: '80px', padding: '0.5rem', backgroundColor: '#333', border: '1px solid #555', borderRadius: '6px', color: 'white', textAlign: 'center' },
};

type PlayerData = {
  Name: string;
  Eigenes_Rathaus: number | null;
  [key: string]: number | string | null;
};

type ResultData = { Name: string; Punkte: number; };
type Award = { name: string; score: string; };
type PointSystem = { [key: string]: number };

const DEFAULT_POINT_SYSTEM: PointSystem = {
    "ell_gt_2": 3, "ell_eq_1": 2, "ell_eq_0": 1, "ell_eq_-1": 0, "ell_lt_-2": -1,
    "atk_3s_gt_2": 6, "atk_3s_eq": 4, "atk_3s_lt_-2": 2, "atk_2s_ge_90": 4,
    "atk_2s_80_89": 3, "atk_2s_50_79": 2, "atk_1s_90_99": 2, "atk_1s_50_89": 1,
    "aktiv": 1, "bonus_100": 1, "mut_base": 1, "mut_extra": 2, "all_attacks": 2,
};

// --- Main App Component ---
function App() {
  const [clanTag, setClanTag] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<'api_input' | 'config' | 'data_entry' | 'results' | 'settings'>('api_input');
  const [playerData, setPlayerData] = useState<PlayerData[]>([]);
  const [apiRawData, setApiRawData] = useState<PlayerData[]>([]);
  const [resultsData, setResultsData] = useState<ResultData[]>([]);
  const [awards, setAwards] = useState<{mvp: Award, goliath: Award} | null>(null);

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [dontFillOpponentTH, setDontFillOpponentTH] = useState(false);
  
  const [pointSystem, setPointSystem] = useState<PointSystem>(DEFAULT_POINT_SYSTEM);
  const [tempPointSystem, setTempPointSystem] = useState<PointSystem>(DEFAULT_POINT_SYSTEM);

  // --- Local Storage & Autosave ---
  useEffect(() => {
    const savedPoints = localStorage.getItem('cwl-pointSystem');
    const initialPoints = savedPoints ? JSON.parse(savedPoints) : DEFAULT_POINT_SYSTEM;
    setPointSystem(initialPoints);
    setTempPointSystem(initialPoints);

    const savedData = localStorage.getItem('cwl-playerData');
    if (savedData) {
      setPlayerData(JSON.parse(savedData));
      setStep('data_entry');
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerData.length > 0 && step === 'data_entry') {
        localStorage.setItem('cwl-playerData', JSON.stringify(playerData));
        console.log("Autosaved at", new Date().toLocaleTimeString());
      }
    }, 6 * 60 * 1000);
    return () => clearInterval(interval);
  }, [playerData, step]);

  const saveData = (data: PlayerData[]) => {
    localStorage.setItem('cwl-playerData', JSON.stringify(data));
  };

  // --- API & Calculation Logic ---
  const handleFetchData = async () => {
    if (!clanTag || !apiKey) { setError('Bitte Clan-Tag und API-Schlüssel eingeben.'); return; }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://127.0.0.1:8000/clan/${encodeURIComponent(clanTag)}/cwl_data`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Ein unbekannter Fehler ist aufgetreten.');
      
      setApiRawData(data);
      setStep('config');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedFromConfig = () => {
    let processedData = apiRawData.map(player => ({...player}));

    if (isManualEntry) {
      processedData = apiRawData.map(p => ({ Name: p.Name, Eigenes_Rathaus: null }));
    } else if (dontFillOpponentTH) {
      processedData.forEach(player => {
        for (let i = 1; i <= 7; i++) {
          player[`Tag${i}_Rathaus_Gegner`] = null;
        }
      });
    }
    
    const finalData = processedData.map(player => {
        const fullPlayer: PlayerData = { Name: player.Name, Eigenes_Rathaus: player.Eigenes_Rathaus || null };
        for (let i = 1; i <= 7; i++) {
            fullPlayer[`Tag${i}_Rathaus_Gegner`] = player[`Tag${i}_Rathaus_Gegner`] || null;
            fullPlayer[`Tag${i}_Sterne`] = player[`Tag${i}_Sterne`] || null;
            fullPlayer[`Tag${i}_Prozent`] = player[`Tag${i}_Prozent`] || null;
        }
        return fullPlayer;
    });

    setPlayerData(finalData);
    saveData(finalData);
    setStep('data_entry');
  };

  const handleDataChange = (index: number, field: string, value: string) => {
    const newData = [...playerData];
    const numValue = value === '' ? null : parseInt(value, 10);
    newData[index][field] = numValue;
    setPlayerData(newData);
  };

  const handleCalculate = async () => {
    saveData(playerData);
    setIsLoading(true);
    setError(null);
    try {
        const payload = { data: playerData, point_system: pointSystem };
        const response = await fetch(`https://cwl-server-backend.onrender.com/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Fehler bei der Berechnung.');
        
        setResultsData(data);
        calculateAwards(playerData, data);
        setStep('results');
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };
  
  const calculateAwards = (fullData: PlayerData[], summaryData: ResultData[]) => {
    const mvp = { name: summaryData[0]?.Name || 'N/A', score: `${summaryData[0]?.Punkte || 0} Punkte` };
    let goliathScores: {[key: string]: number} = {};
    fullData.forEach(player => {
        goliathScores[player.Name] = 0;
        for (let i = 1; i <= 7; i++) {
            const ownTH = Number(player.Eigenes_Rathaus);
            const oppTH = Number(player[`Tag${i}_Rathaus_Gegner`]);
            if (ownTH > 0 && oppTH > 0 && oppTH >= ownTH + 2) {
                const stars = Number(player[`Tag${i}_Sterne`]) || 0;
                goliathScores[player.Name] += stars * 2;
            }
        }
    });
    const goliathWinner = Object.keys(goliathScores).reduce((a, b) => goliathScores[a] > goliathScores[b] ? a : b, 'Niemand');
    const goliath = {
        name: goliathScores[goliathWinner] > 0 ? goliathWinner : 'Niemand',
        score: goliathScores[goliathWinner] > 0 ? `${goliathScores[goliathWinner]} Punkte gegen höhere RH` : 'Keine Angriffe auf viel höhere RH'
    };
    setAwards({ mvp, goliath });
  };

  const downloadExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + ["Name", "Punkte"].join(",") + "\n" 
        + resultsData.map(e => `"${e.Name}",${e.Punkte}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cwl_bonus_wertung.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetApp = () => {
    localStorage.removeItem('cwl-playerData');
    setClanTag(''); setApiKey(''); setPlayerData([]); setApiRawData([]); setResultsData([]); setError(null); setStep('api_input');
  };

  // --- Settings Logic ---
  const handlePointChange = (key: string, value: string) => {
    setTempPointSystem(prev => ({ ...prev, [key]: value === '' ? 0 : parseInt(value, 10) }));
  };
  const applyPointsForSession = () => {
    setPointSystem(tempPointSystem);
    setStep('api_input');
  };
  const savePointsPermanently = () => {
    setPointSystem(tempPointSystem);
    localStorage.setItem('cwl-pointSystem', JSON.stringify(tempPointSystem));
    setStep('api_input');
  };
  const resetPointsToDefault = () => {
    setTempPointSystem(DEFAULT_POINT_SYSTEM);
  };

  // --- Render Logic ---
  const renderContent = () => {
    switch (step) {
      case 'settings':
        return (
            <div style={styles.card}>
                <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '2rem' }}>Einstellungen</h2>
                <h3 style={styles.h5}>Punktesystem</h3>
                {Object.keys(tempPointSystem).map(key => (
                    <div key={key} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                        <label style={{color: '#a0a0a0'}}>{key.replace(/_/g, ' ')}</label>
                        <input 
                            type="number" 
                            value={tempPointSystem[key]} 
                            onChange={(e) => handlePointChange(key, e.target.value)}
                            style={styles.settingsInput}
                        />
                    </div>
                ))}
                <div style={styles.buttonContainer}>
                    <button onClick={resetPointsToDefault} style={styles.secondaryButton}>Auf Standard zurücksetzen</button>
                </div>
                 <div style={styles.buttonContainer}>
                    <button onClick={applyPointsForSession} style={styles.secondaryButton}>Nur für diesen Lauf</button>
                    <button onClick={savePointsPermanently} style={styles.button}>Dauerhaft speichern</button>
                </div>
                 <div style={styles.buttonContainer}>
                    <button onClick={() => setStep('api_input')} style={styles.secondaryButton}>Zurück zum Start</button>
                 </div>
            </div>
        );
      case 'results':
        return (
            <div style={styles.card}>
                <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '1rem' }}>Endwertung</h2>
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>Punkte</th></tr></thead>
                        <tbody>{resultsData.map((p) => (<tr key={p.Name}><td style={styles.td}>{p.Name}</td><td style={styles.td}>{p.Punkte}</td></tr>))}</tbody>
                    </table>
                </div>
                <hr style={styles.hr} />
                <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '1.5rem' }}>🏆 Clan Awards</h2>
                <div style={{display: 'flex', gap: '1rem'}}>
                    <div style={{...styles.awardCard, flex: 1}}>
                        <div style={styles.awardTitle}>🏅 MVP</div>
                        <div style={styles.awardName}>{awards?.mvp.name}</div>
                        <div style={styles.awardScore}>{awards?.mvp.score}</div>
                    </div>
                    <div style={{...styles.awardCard, flex: 1}}>
                        <div style={styles.awardTitle}>⚔️ David gegen Goliath</div>
                        <div style={styles.awardName}>{awards?.goliath.name}</div>
                        <div style={styles.awardScore}>{awards?.goliath.score}</div>
                    </div>
                </div>
                <hr style={styles.hr} />
                <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '1.5rem' }}>📊 Grafische Auswertung</h2>
                <div style={{width: '100%', height: 300}}>
                    <ResponsiveContainer>
                        <BarChart data={resultsData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <XAxis dataKey="Name" stroke="#a0a0a0" />
                            <YAxis stroke="#a0a0a0" />
                            <Tooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }} />
                            <Bar dataKey="Punkte" fill="#e94057" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <hr style={styles.hr} />
                <button onClick={downloadExcel} style={styles.secondaryButton}>📥 Excel herunterladen</button>
                <div style={styles.buttonContainer}>
                    <button onClick={() => setStep('data_entry')} style={styles.secondaryButton}>Zurück</button>
                    <button onClick={resetApp} style={styles.button}>Neuen Durchgang starten</button>
                </div>
            </div>
        );
      case 'config':
        return (
          <div style={styles.card}>
            <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '2rem' }}>Konfiguration</h2>
            <p style={{color: '#a0a0a0', marginBottom: '1.5rem'}}>Daten erfolgreich abgerufen! Wähle aus, wie die Tabellen befüllt werden sollen.</p>
            <div style={styles.checkboxContainer}>
              <input type="checkbox" id="manual" style={styles.checkbox} checked={isManualEntry} onChange={(e) => setIsManualEntry(e.target.checked)} />
              <label htmlFor="manual">Alles manuell eintragen (nur Namen übernehmen)</label>
            </div>
            <div style={{...styles.checkboxContainer, opacity: isManualEntry ? 0.5 : 1}}>
              <input type="checkbox" id="noOppTH" style={styles.checkbox} checked={dontFillOpponentTH} onChange={(e) => setDontFillOpponentTH(e.target.checked)} disabled={isManualEntry} />
              <label htmlFor="noOppTH">Gegner-RH nicht automatisch ausfüllen</label>
            </div>
            <div style={styles.buttonContainer}>
               <button onClick={() => setStep('api_input')} style={styles.secondaryButton}>Zurück</button>
               <button onClick={handleProceedFromConfig} style={styles.button}>Weiter zur Tabelle</button>
            </div>
          </div>
        );
      case 'data_entry':
        return (
          <div style={styles.card}>
            <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '1rem' }}>Daten überprüfen & vervollständigen</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th><th style={styles.th}>Eigenes RH</th>
                    {[...Array(7)].map((_, i) => <th key={i} style={styles.th}>{`Tag ${i + 1} ERL`}</th>)}
                    {[...Array(7)].map((_, i) => <th key={i} style={styles.th}>{`Tag ${i + 1} ⭐`}</th>)}
                    {[...Array(7)].map((_, i) => <th key={i} style={styles.th}>{`Tag ${i + 1} %`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {playerData.map((player, index) => (
                    <tr key={player.Name}>
                      <td style={styles.td}>{player.Name}</td>
                      <td style={styles.td}><input type="number" style={styles.tableInput} value={player.Eigenes_Rathaus || ''} onChange={(e) => handleDataChange(index, 'Eigenes_Rathaus', e.target.value)} /></td>
                      {[...Array(7)].map((_, i) => (<td key={i} style={styles.td}><input type="number" style={styles.tableInput} value={player[`Tag${i + 1}_Rathaus_Gegner`] || ''} onChange={(e) => handleDataChange(index, `Tag${i + 1}_Rathaus_Gegner`, e.target.value)} /></td>))}
                      {[...Array(7)].map((_, i) => (<td key={i} style={styles.td}><input type="number" style={styles.tableInput} value={player[`Tag${i + 1}_Sterne`] || ''} onChange={(e) => handleDataChange(index, `Tag${i + 1}_Sterne`, e.target.value)} /></td>))}
                      {[...Array(7)].map((_, i) => (<td key={i} style={styles.td}><input type="number" style={styles.tableInput} value={player[`Tag${i + 1}_Prozent`] || ''} onChange={(e) => handleDataChange(index, `Tag${i + 1}_Prozent`, e.target.value)} /></td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={styles.buttonContainer}>
              <button onClick={() => setStep('config')} style={styles.secondaryButton}>Zurück</button>
              <button onClick={handleCalculate} style={{...styles.button, ...(isLoading ? styles.disabledButton : {})}} disabled={isLoading}>
                  {isLoading ? 'Berechne...' : 'Berechnen & Auswerten'}
              </button>
            </div>
          </div>
        );
      case 'api_input':
      default:
        return (
          <div style={styles.card}>
            <div style={{position: 'relative'}}>
                <span onClick={() => setStep('settings')} style={styles.settingsIcon} title="Einstellungen">⚙️</span>
                <h2 style={{ color: 'white', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>Live-Daten abrufen</h2>
            </div>
            <div>
              <label htmlFor="clanTag" style={styles.label}>Dein Clan-Tag</label>
              <input id="clanTag" type="text" value={clanTag} onChange={(e) => setClanTag(e.target.value.toUpperCase())} placeholder="#2PP" style={styles.input} disabled={isLoading} />
            </div>
            <div>
              <label htmlFor="apiKey" style={styles.label}>Dein API-Schlüssel</label>
              <input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Einfügen aus der CoC Developer Seite" style={styles.input} disabled={isLoading} />
            </div>
            <button onClick={handleFetchData} style={{...styles.button, ...(isLoading ? styles.disabledButton : {})}} disabled={isLoading}>
              {isLoading ? 'Lade...' : 'CWL-Daten abrufen'}
            </button>
            {error && (<div style={styles.errorBox}><strong>Fehler:</strong> {error}</div>)}
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ textAlign: 'center' }}><div style={styles.titleBox}>CWL Bonus Rechner</div></div>
      {renderContent()}
    </div>
  );
}

export default App;