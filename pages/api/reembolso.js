import nodemailer from 'nodemailer';
import formidable from 'formidable';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const config = {
  api: {
    bodyParser: false,
  },
};

const generatePDFBuffer = (fields, tableRows) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    // --- CABEÇALHO ---
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    
    const titulo = fields.tipo_solicitacao === 'reembolso' 
        ? "REEMBOLSO DE DESPESAS" 
        : "SOLICITAÇÃO DE PAGAMENTO";
        
    doc.text(titulo, 148, 20, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(10, 25, 286, 25); 

    // --- DADOS GERAIS ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    let y = 35;
    const col1 = 15;
    const col2 = 150;

    doc.text(`Solicitante: ${fields.solicitante}`, col1, y);
    doc.text(`Data: ${fields.data_solicitacao}`, col2, y);
    y += 7;
    doc.text(`Beneficiado: ${fields.beneficiado}`, col1, y);
    y += 7;
    doc.text(`Departamento: ${fields.departamento}`, col1, y);
    y += 7;
    doc.text(`CPF/CNPJ: ${fields.cpf_cnpj}`, col1, y);
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("DADOS BANCÁRIOS / PIX", col1, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Banco: ${fields.banco || '-'}`, col1, y);
    doc.text(`Agência: ${fields.agencia || '-'}`, col1 + 60, y);
    doc.text(`C/C: ${fields.conta || '-'}`, col1 + 100, y);
    y += 6;
    doc.text(`Chave PIX: ${fields.pix || '-'}`, col1, y);

    y += 10;
    doc.text(`Nível de Urgência: ${fields.urgencia.toUpperCase()}`, col1, y);
    doc.text(`Data para Pagamento: ${fields.data_pagamento}`, col2, y);

    // --- TABELA DE GASTOS ---
    const head = [['Data', 'Detalhe', 'Tipo', 'Valor (R$)', 'Km', 'Val. Km', 'Total Km', 'TOTAL', 'Cobrar Cliente']];
    
    const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const body = tableRows.map(row => [
        row.data,
        row.detalhe,
        row.tipo,
        fmt(row.valor_despesa),
        row.km_rodado || '-',
        fmt(row.valor_unit_km),
        fmt(row.total_km),
        fmt(row.total_gasto), 
        // Lógica nova para exibir o nome do cliente no PDF
        row.cobrar_cliente === 'true' ? `SIM\n(${row.nome_cliente})` : 'NÃO'
    ]);

    const totalGeral = tableRows.reduce((acc, row) => acc + parseFloat(row.total_gasto || 0), 0);
    body.push(['', '', '', '', '', '', 'TOTAL GERAL:', fmt(totalGeral), '']);

    autoTable(doc, {
        startY: y + 10,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [22, 78, 99], textColor: 255 },
        columnStyles: {
            7: { fontStyle: 'bold', fillColor: [240, 240, 240] },
            8: { fontSize: 7 } // Diminui a fonte da coluna cliente para caber o nome
        },
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // --- TERMO ---
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    const termo = "(*) Declaro que caso não preste as contas devidas no prazo de 30(trinta) dias contados a partir da presente data ou no mesmo prazo haja saldo devedor em aberto, fica autorizado o desconto do valor devido em folha de pagamento ou no Termo de Rescisão do Contrato de Trabalho, conforme artigo 462 da CLT.";
    const splitTermo = doc.splitTextToSize(termo, 270);
    doc.text(splitTermo, 15, finalY);

    // --- ASSINATURA ---
    finalY += 30;
    doc.setDrawColor(0);
    doc.setTextColor(0);
    doc.line(100, finalY, 196, finalY);
    doc.text("Assinatura do Solicitante / Aprovador", 148, finalY + 5, { align: "center" });

    return Buffer.from(doc.output('arraybuffer'));
};

async function enviarNotificacaoDiscord(fields, total) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const totalFormatado = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const payload = {
    content: `💰 **Nova Solicitação: ${fields.tipo_solicitacao.toUpperCase()}**`,
    embeds: [
      {
        title: `Total: ${totalFormatado}`,
        color: fields.urgencia === 'imediato' ? 0xFF0000 : 0x0099ff,
        fields: [
          { name: 'Solicitante', value: fields.solicitante, inline: true },
          { name: 'Departamento', value: fields.departamento, inline: true },
          { name: 'Urgência', value: fields.urgencia.toUpperCase(), inline: true },
          { name: 'Data Pagto', value: fields.data_pagamento, inline: true },
        ],
        footer: { text: 'Sistema Maglog - Financeiro' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
  } catch (error) { console.error(error); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const form = formidable({ multiples: true });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const getVal = (v) => Array.isArray(v) ? v[0] : v;
    
    const dados = {
        tipo_solicitacao: getVal(fields.tipo_solicitacao),
        solicitante: getVal(fields.solicitante),
        data_solicitacao: getVal(fields.data_solicitacao),
        beneficiado: getVal(fields.beneficiado),
        departamento: getVal(fields.departamento),
        cpf_cnpj: getVal(fields.cpf_cnpj),
        banco: getVal(fields.banco),
        agencia: getVal(fields.agencia),
        conta: getVal(fields.conta),
        pix: getVal(fields.pix),
        urgencia: getVal(fields.urgencia),
        data_pagamento: getVal(fields.data_pagamento),
    };

    const tableRows = [];
    const rowCount = parseInt(getVal(fields.row_count) || '0');
    let totalGeral = 0;

    for (let i = 0; i < rowCount; i++) {
        const row = {
            data: getVal(fields[`data_${i}`]),
            detalhe: getVal(fields[`detalhe_${i}`]),
            tipo: getVal(fields[`tipo_${i}`]),
            valor_despesa: parseFloat(getVal(fields[`valor_despesa_${i}`]) || 0),
            km_rodado: parseFloat(getVal(fields[`km_rodado_${i}`]) || 0),
            valor_unit_km: parseFloat(getVal(fields[`valor_unit_km_${i}`]) || 0),
            cobrar_cliente: getVal(fields[`cobrar_cliente_${i}`]),
            nome_cliente: getVal(fields[`nome_cliente_${i}`]) || '', // Captura o nome
        };
        
        row.total_km = row.km_rodado * row.valor_unit_km;
        row.total_gasto = row.valor_despesa + row.total_km;
        
        totalGeral += row.total_gasto;
        tableRows.push(row);
    }

    const pdfBuffer = generatePDFBuffer(dados, tableRows);

    const attachments = [
        {
            filename: `Reembolso_${dados.solicitante.split(' ')[0]}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }
    ];

    const uploadedFiles = files.anexos; 
    if (uploadedFiles) {
        const filesArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
        filesArray.forEach(file => {
            attachments.push({
                filename: file.originalFilename,
                path: file.filepath
            });
        });
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        secure: false,
        auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
    });

    await transporter.sendMail({
        from: `"${dados.solicitante}" <${process.env.EMAIL_FROM}>`,
        to: process.env.EMAIL_TO,
        subject: `Reembolso/Pagto - ${dados.departamento} - ${dados.solicitante}`,
        html: `<p>Nova solicitação recebida.</p><p><strong>Total:</strong> R$ ${totalGeral.toFixed(2)}</p>`,
        attachments: attachments,
    });

    await enviarNotificacaoDiscord(dados, totalGeral);

    return res.status(200).json({ message: 'Solicitação enviada!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
}