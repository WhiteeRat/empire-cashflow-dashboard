import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Edge function: extrai lançamentos de um extrato bancário a partir de texto bruto (PDF).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em conciliação bancária brasileira.
Sua tarefa: a partir do texto bruto de um extrato bancário (PDF), extrair TODOS os lançamentos
(data, descrição, valor, tipo: receita ou despesa). Ignore saldos, totalizadores e cabeçalhos.
- Datas devem ser convertidas para o formato YYYY-MM-DD. Se o ano não estiver explícito, use o ano corrente.
- Valor sempre positivo. Use "type": "despesa" para débitos/saídas e "receita" para créditos/entradas.
- Descrição limpa, sem códigos irrelevantes.
Responda SEMPRE chamando a função extract_bank_transactions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Ano corrente: ${new Date().getFullYear()}\n\nTexto extraído do extrato:\n${text.slice(0, 60000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_bank_transactions",
            description: "Extrai lançamentos do extrato bancário",
            parameters: {
              type: "object",
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", description: "YYYY-MM-DD" },
                      description: { type: "string" },
                      amount: { type: "number", description: "Sempre positivo" },
                      type: { type: "string", enum: ["receita", "despesa"] },
                    },
                    required: ["date", "description", "amount", "type"],
                  },
                },
              },
              required: ["rows"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_bank_transactions" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente em alguns instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione saldo em Lovable AI." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { rows: [] };

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-bank-statement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
