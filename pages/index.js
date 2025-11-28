import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';

// Componente MoneyInput (fora da função principal)
const MoneyInput = ({ value, onChange, disabled, placeholder, className }) => (
  <input 
      type="number" 
      step="0.01" 
      value={value} 
      onChange={onChange}
      disabled={disabled} 
      placeholder={placeholder}
      className={className} 
  />
);

export default function ReembolsoPage() {
  const [status, setStatus] = useState({ submitting: false, success: false, error: '' });
  const [formData, setFormData] = useState({
    tipo_solicitacao: 'reembolso',
    solicitante: '',
    data_solicitacao: '',
    beneficiado: '',
    departamento: '',
    cpf_cnpj: '',
    banco: '',
    agencia: '',
    conta: '',
    pix: '',
    urgencia: 'normal',
    data_pagamento: '',
    concordo: false
  });

  const [rows, setRows] = useState([
    { data: '', detalhe: '', tipo: 'Outros', valor_despesa: '', km_rodado: '', valor_unit_km: '', cobrar_cliente: false, nome_cliente: '' }
  ]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, data_solicitacao: new Date().toLocaleDateString('pt-BR') }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    if (field === 'cobrar_cliente') {
        newRows[index][field] = value;
        if (!value) newRows[index]['nome_cliente'] = '';
    } else if (['valor_despesa', 'km_rodado', 'valor_unit_km'].includes(field)) {
        newRows[index][field] = value === '' ? '' : parseFloat(value);
    } else {
        newRows[index][field] = value;
    }
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, { data: '', detalhe: '', tipo: 'Outros', valor_despesa: '', km_rodado: '', valor_unit_km: '', cobrar_cliente: false, nome_cliente: '' }]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) setRows(rows.filter((_, i) => i !== index));
  };

  const calculateRowTotal = (row) => {
    const valDespesa = parseFloat(row.valor_despesa) || 0;
    const km = parseFloat(row.km_rodado) || 0;
    const valUnit = parseFloat(row.valor_unit_km) || 0;
    return valDespesa + (km * valUnit);
  };

  const grandTotal = rows.reduce((acc, row) => acc + calculateRowTotal(row), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ submitting: true, success: false, error: '' });

    if (!formData.concordo) {
        setStatus({ submitting: false, error: 'Você precisa concordar com os termos da CLT para prosseguir.', success: false });
        return;
    }

    const temDescarga = rows.some(r => r.tipo === 'Descarga');
    const fileInput = document.getElementById('anexos');
    if (temDescarga && (!fileInput.files || fileInput.files.length === 0)) {
        setStatus({ submitting: false, error: 'Para despesas de "Descarga", é OBRIGATÓRIO anexar o CTE/Comprovante.', success: false });
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        if (rows[i].cobrar_cliente && !rows[i].nome_cliente.trim()) {
            setStatus({ submitting: false, error: `Na linha ${i + 1}, você marcou "Cobrar Cliente" mas não informou o nome do cliente.`, success: false });
            return;
        }
    }

    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => payload.append(key, value));
    for (let i = 0; i < fileInput.files.length; i++) {
        payload.append('anexos', fileInput.files[i]);
    }
    payload.append('row_count', rows.length);
    rows.forEach((row, index) => {
        Object.entries(row).forEach(([key, value]) => {
            let finalValue = value;
            if (['valor_despesa', 'km_rodado', 'valor_unit_km'].includes(key)) {
                finalValue = value === '' ? 0 : value;
            }
            payload.append(`${key}_${index}`, finalValue);
        });
    });

    try {
      const response = await fetch('/api/reembolso', { method: 'POST', body: payload });
      if (!response.ok) throw new Error('Erro ao enviar.');
      setStatus({ submitting: false, success: true, error: '' });
      setFormData(prev => ({ ...prev, concordo: false }));
      setRows([{ data: '', detalhe: '', tipo: 'Outros', valor_despesa: '', km_rodado: '', valor_unit_km: '', cobrar_cliente: false, nome_cliente: '' }]);
    } catch (error) {
      setStatus({ submitting: false, success: false, error: error.message });
    }
  };

  // --- ESTILOS CSS ---
  const labelStyles = "block font-bold text-gray-700 dark:text-gray-300 text-xs uppercase mb-1";
  
  // Estilo Geral de Input
  const baseInputStyles = "border rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm border-gray-300 disabled:bg-gray-200 disabled:dark:bg-gray-800 disabled:text-gray-400 disabled:dark:text-gray-600 disabled:cursor-not-allowed";
  
  // Input Padrão (Mobile e Formulário Topo)
  const inputStyles = `w-full px-3 py-3 ${baseInputStyles} bg-gray-50 dark:bg-gray-900 dark:border-gray-600 dark:text-white`;

  // Input de Tabela (Desktop) - Altura fixa h-10
  const tableInputStyles = `w-full h-10 px-2 ${baseInputStyles} bg-transparent dark:text-white dark:border-gray-600`;

  // --- CORREÇÃO 1 e 2: Estilo específico para SELECT ---
  // dark:bg-gray-800 -> Garante fundo escuro no dropdown para ler o texto branco
  // max-w-full -> Garante que não estoure a tela no mobile
  const selectStyles = `w-full h-10 px-2 ${baseInputStyles} bg-transparent dark:bg-gray-800 dark:text-white dark:border-gray-600 max-w-full`;
  const mobileSelectStyles = `w-full px-3 py-3 ${baseInputStyles} bg-gray-50 dark:bg-gray-900 dark:border-gray-600 dark:text-white max-w-full`;

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-2 md:p-4 font-sans transition-colors duration-200">
      <Head><title>Requisição Financeira</title></Head>
      
      <div className="w-full max-w-[98%] md:max-w-[95%] mx-auto bg-white dark:bg-gray-800 p-4 md:p-8 rounded-lg shadow-xl border-t-8 border-cyan-900 dark:border-cyan-600">
        
        <div className="flex justify-center mb-4 md:mb-6">
            <Image src="/logo.png" alt="Logo Maglog" width={150} height={50} priority className="w-32 md:w-48 h-auto" />
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-center text-cyan-900 dark:text-cyan-400 mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
            FORMULÁRIO DE REQUISIÇÃO FINANCEIRA
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-6 mb-6 bg-gray-100 dark:bg-gray-700 p-4 rounded">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                    <input type="radio" name="tipo_solicitacao" value="reembolso" checked={formData.tipo_solicitacao === 'reembolso'} onChange={handleInputChange} className="w-5 h-5 text-cyan-900 focus:ring-cyan-500" />
                    <span className="font-bold text-base md:text-lg text-gray-800 dark:text-white">REEMBOLSO DE DESPESAS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                    <input type="radio" name="tipo_solicitacao" value="pagamento" checked={formData.tipo_solicitacao === 'pagamento'} onChange={handleInputChange} className="w-5 h-5 text-cyan-900 focus:ring-cyan-500" />
                    <span className="font-bold text-base md:text-lg text-gray-800 dark:text-white">SOLICITAÇÃO DE PAGAMENTO</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelStyles}>Solicitante</label><input required name="solicitante" value={formData.solicitante} onChange={handleInputChange} className={inputStyles} /></div>
                <div><label className={labelStyles}>Data</label><input disabled value={formData.data_solicitacao} className={`${inputStyles} bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300`} /></div>
                <div className="md:col-span-2"><label className={labelStyles}>Beneficiado (Quem recebe)</label><input required name="beneficiado" value={formData.beneficiado} onChange={handleInputChange} className={inputStyles} /></div>
                <div><label className={labelStyles}>Departamento</label><input required name="departamento" value={formData.departamento} onChange={handleInputChange} className={inputStyles} /></div>
                <div><label className={labelStyles}>CPF / CNPJ</label><input required name="cpf_cnpj" value={formData.cpf_cnpj} onChange={handleInputChange} className={inputStyles} /></div>
            </div>

            <fieldset className="border border-gray-300 dark:border-gray-600 p-3 rounded bg-gray-50 dark:bg-gray-700/50">
                <legend className="font-bold text-cyan-900 dark:text-cyan-400 px-2 text-sm md:text-base">Dados Bancários / PIX</legend>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div><label className={labelStyles}>Banco</label><input name="banco" value={formData.banco} onChange={handleInputChange} className={inputStyles} /></div>
                    <div><label className={labelStyles}>Agência</label><input name="agencia" value={formData.agencia} onChange={handleInputChange} className={inputStyles} /></div>
                    <div><label className={labelStyles}>Conta</label><input name="conta" value={formData.conta} onChange={handleInputChange} className={inputStyles} /></div>
                    <div><label className={labelStyles}>Chave PIX</label><input name="pix" value={formData.pix} onChange={handleInputChange} className={inputStyles} /></div>
                </div>
            </fieldset>

            <div className="flex flex-col md:flex-row gap-4 items-end bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800/50">
                <div className="w-full md:w-1/2">
                    <label className={labelStyles}>Nível de Urgência</label>
                    <select name="urgencia" value={formData.urgencia} onChange={handleInputChange} className={mobileSelectStyles}>
                        <option value="normal">Normal</option>
                        <option value="imediato">Imediato</option>
                    </select>
                </div>
                <div className="w-full md:w-1/2">
                    <label className={labelStyles}>Data para Pagamento</label>
                    <input type="date" required name="data_pagamento" value={formData.data_pagamento} onChange={handleInputChange} className={inputStyles} />
                </div>
            </div>

            {/* --- VERSÃO DESKTOP (TABELA) --- */}
            <div className="hidden md:block overflow-x-auto border border-gray-300 dark:border-gray-600 rounded mt-6">
                <table className="w-full text-sm border-collapse min-w-[1000px]">
                    <thead className="bg-cyan-900 dark:bg-cyan-950 text-white">
                        <tr>
                            <th className="p-2 border border-cyan-800 w-32">Data</th>
                            <th className="p-2 border border-cyan-800 w-64">Detalhe</th>
                            <th className="p-2 border border-cyan-800 bg-cyan-800">
                                Tipo Despesa
                                <span className="block text-[10px] text-yellow-300 font-normal mt-1">(* Se "Descarga", anexar CTE)</span>
                            </th>
                            <th className="p-2 border border-cyan-800 w-24">Valor R$</th>
                            <th className="p-2 border border-cyan-800 w-20">Km</th>
                            <th className="p-2 border border-cyan-800 w-20">Val. Km</th>
                            <th className="p-2 border border-cyan-800 bg-cyan-800 dark:bg-cyan-900 w-28">TOTAL</th>
                            <th className="p-2 border border-cyan-800 text-xs w-32">Cobrar Cliente?</th>
                            <th className="p-2 border border-cyan-800 w-12 text-xs">Excluir</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {rows.map((row, index) => {
                            const hasKm = (parseFloat(row.km_rodado) > 0) || (parseFloat(row.valor_unit_km) > 0);
                            const hasValor = parseFloat(row.valor_despesa) > 0;
                            return (
                                <tr key={index} className="bg-white dark:bg-gray-800 text-center align-middle">
                                    <td className="p-1 border dark:border-gray-600"><input type="date" value={row.data} onChange={e => handleRowChange(index, 'data', e.target.value)} className={tableInputStyles} /></td>
                                    <td className="p-1 border dark:border-gray-600"><input type="text" value={row.detalhe} onChange={e => handleRowChange(index, 'detalhe', e.target.value)} className={tableInputStyles} placeholder="Descrição" /></td>
                                    <td className="p-1 border dark:border-gray-600">
                                        <select value={row.tipo} onChange={e => handleRowChange(index, 'tipo', e.target.value)} className={selectStyles}>
                                            <option value="Outros">Outros</option>
                                            <option value="Combustível">Combustível</option>
                                            <option value="Pedágio">Pedágio</option>
                                            <option value="Refeição">Refeição</option>
                                            <option value="Estacionamento">Estacionamento</option>
                                            <option value="Manutenção">Manutenção</option>
                                            <option value="Correio">Correio</option>
                                            <option value="Cópia">Cópia</option>
                                            <option value="Descarga">Descarga</option>
                                        </select>
                                    </td>
                                    <td className="p-1 border dark:border-gray-600"><MoneyInput value={row.valor_despesa} onChange={e => handleRowChange(index, 'valor_despesa', e.target.value)} disabled={hasKm} placeholder={hasKm ? "Bloq." : "0,00"} className={`${tableInputStyles} text-right`} /></td>
                                    <td className="p-1 border dark:border-gray-600"><input type="number" step="1" value={row.km_rodado} onChange={e => handleRowChange(index, 'km_rodado', e.target.value)} disabled={hasValor} className={`${tableInputStyles} text-center`} /></td>
                                    <td className="p-1 border dark:border-gray-600"><MoneyInput value={row.valor_unit_km} onChange={e => handleRowChange(index, 'valor_unit_km', e.target.value)} disabled={hasValor} placeholder="0,00" className={`${tableInputStyles} text-center`} /></td>
                                    <td className="p-1 border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 font-bold text-cyan-900 dark:text-cyan-300">
                                        <div className="flex items-center justify-center h-10">
                                            {calculateRowTotal(row).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                    </td>
                                    <td className="p-1 border dark:border-gray-600">
                                        <div className="flex flex-col justify-center items-center h-full gap-1">
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={row.cobrar_cliente} onChange={e => handleRowChange(index, 'cobrar_cliente', e.target.checked)} className="w-4 h-4 rounded text-cyan-600" /><span className="text-xs text-gray-600 dark:text-gray-400">Sim</span></label>
                                            {row.cobrar_cliente && (<input type="text" placeholder="Cliente" value={row.nome_cliente} onChange={e => handleRowChange(index, 'nome_cliente', e.target.value)} className="w-full h-6 text-xs px-1 border border-orange-300 rounded bg-orange-50 dark:bg-gray-700 dark:text-white" />)}
                                        </div>
                                    </td>
                                    <td className="p-1 border dark:border-gray-600">{rows.length > 1 && <button type="button" onClick={() => removeRow(index)} className="text-red-500 hover:text-red-400 font-bold px-2 h-10 flex items-center justify-center w-full">X</button>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- VERSÃO MOBILE (CARDS) --- */}
            <div className="block md:hidden space-y-4 mt-6">
                <h3 className="font-bold text-cyan-900 dark:text-cyan-400 text-lg border-b border-gray-300 dark:border-gray-700 pb-2">Itens da Despesa</h3>
                {rows.map((row, index) => {
                    const hasKm = (parseFloat(row.km_rodado) > 0) || (parseFloat(row.valor_unit_km) > 0);
                    const hasValor = parseFloat(row.valor_despesa) > 0;
                    return (
                        <div key={index} className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 p-4 rounded shadow-sm relative transition-colors">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="font-bold text-gray-600 dark:text-white">Item #{index + 1}</span>
                                {rows.length > 1 && <button type="button" onClick={() => removeRow(index)} className="text-red-500 dark:text-red-300 text-sm font-bold border border-red-200 dark:border-red-800 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/50">Excluir</button>}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                <div><label className={labelStyles}>Data</label><input type="date" value={row.data} onChange={e => handleRowChange(index, 'data', e.target.value)} className={inputStyles} /></div>
                                <div><label className={labelStyles}>Detalhe</label><input type="text" value={row.detalhe} onChange={e => handleRowChange(index, 'detalhe', e.target.value)} className={inputStyles} /></div>
                                <div>
                                    <label className={labelStyles}>Tipo {row.tipo === 'Descarga' && <span className="text-yellow-600 dark:text-yellow-400 text-[10px]">(Anexar CTE)</span>}</label>
                                    <select value={row.tipo} onChange={e => handleRowChange(index, 'tipo', e.target.value)} className={mobileSelectStyles}>
                                        <option value="Outros">Outros</option>
                                        <option value="Combustível">Combustível</option>
                                        <option value="Pedágio">Pedágio</option>
                                        <option value="Refeição">Refeição</option>
                                        <option value="Estacionamento">Estacionamento</option>
                                        <option value="Manutenção">Manutenção</option>
                                        <option value="Correio">Correio</option>
                                        <option value="Cópia">Cópia</option>
                                        <option value="Descarga">Descarga</option>
                                    </select>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 space-y-3">
                                    <div><label className={labelStyles}>Valor R$ (Direto)</label><MoneyInput value={row.valor_despesa} onChange={e => handleRowChange(index, 'valor_despesa', e.target.value)} disabled={hasKm} placeholder={hasKm ? "Bloq." : "0,00"} className={inputStyles} /></div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className={labelStyles}>KM Rodado</label><input type="number" value={row.km_rodado} onChange={e => handleRowChange(index, 'km_rodado', e.target.value)} disabled={hasValor} className={inputStyles} /></div>
                                        <div><label className={labelStyles}>Valor Unit. KM</label><MoneyInput value={row.valor_unit_km} onChange={e => handleRowChange(index, 'valor_unit_km', e.target.value)} disabled={hasValor} placeholder="0,00" className={inputStyles} /></div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex flex-col md:flex-row justify-between items-end gap-3">
                                    <div className="flex-grow w-full">
                                        <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                            <input type="checkbox" checked={row.cobrar_cliente} onChange={e => handleRowChange(index, 'cobrar_cliente', e.target.checked)} className="w-5 h-5 text-cyan-600 rounded" />
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Cobrar Cliente?</span>
                                        </label>
                                        {row.cobrar_cliente && (
                                            <input type="text" placeholder="Nome do Cliente" value={row.nome_cliente} onChange={e => handleRowChange(index, 'nome_cliente', e.target.value)} className={`${inputStyles} border-orange-300 focus:ring-orange-500`} />
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end w-full">
                                        <label className="block text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Total desta linha</label>
                                        <div className="text-xl font-extrabold text-cyan-900 dark:text-cyan-400 bg-cyan-50 dark:bg-gray-900 px-3 py-1 rounded w-full text-right border border-cyan-100 dark:border-cyan-900">
                                            {calculateRowTotal(row).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-100 dark:bg-gray-700 p-4 rounded gap-4 mt-6">
                <button type="button" onClick={addRow} className="w-full md:w-auto text-sm bg-cyan-600 text-white px-6 py-3 rounded hover:bg-cyan-700 transition-colors font-bold">+ ADICIONAR ITEM</button>
                <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-xl md:text-2xl font-bold text-cyan-900 dark:text-white">
                    <span>TOTAL GERAL:</span>
                    <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded border border-cyan-900 dark:border-cyan-400">
                        {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-700 rounded">
                <label className={labelStyles}>Anexar Comprovantes / Notas / CTE</label>
                <input type="file" id="anexos" multiple className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-cyan-100 dark:file:bg-cyan-900 file:text-cyan-700 dark:file:text-cyan-300 hover:file:bg-cyan-200 dark:hover:file:bg-cyan-800" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pode selecionar múltiplos arquivos.</p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800/50 rounded text-red-800 dark:text-red-300 text-xs text-justify">
                <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" name="concordo" checked={formData.concordo} onChange={handleInputChange} className="mt-1 w-5 h-5 text-red-600 focus:ring-red-500 flex-shrink-0" />
                    <span className="ml-2">
                        (*) Declaro que caso não preste as contas devidas no prazo de 30(trinta) dias contados a partir da presente data ou no mesmo prazo haja saldo devedor em aberto, 
                        fica autorizado o desconto do valor devido em folha de pagamento ou no Termo de Rescisão do Contrato de Trabalho, conforme artigo 462 da CLT.
                    </span>
                </label>
            </div>

            <div className="text-center pb-8">
                <button type="submit" disabled={status.submitting} className="w-full md:w-1/2 bg-cyan-900 dark:bg-cyan-700 text-white font-bold py-4 rounded shadow hover:bg-cyan-800 dark:hover:bg-cyan-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors text-lg">
                    {status.submitting ? 'ENVIANDO...' : 'ENVIAR SOLICITAÇÃO'}
                </button>
            </div>

            {status.success && <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded text-center font-bold mb-8">Solicitação Enviada com Sucesso!</div>}
            {status.error && <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded text-center font-bold mb-8">{status.error}</div>}

        </form>
      </div>
    </div>
  );
}