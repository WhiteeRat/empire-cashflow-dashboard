import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Edge function: extrai dados estruturados de um Informe de Rendimentos.
// Aceita texto bruto (extraído no client de PDF/CSV/Excel) e devolve JSON
// estruturado por fonte pagadora, com sugestão de classificação tributável/isento.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em contabilidade brasileira (IRPF/IRPJ).
Sua tarefa: a partir de um texto bruto extraído de um Informe de Rendimentos,
extrair as fontes pagadoras com seus valores e classificar cada item.
Responda SEMPRE chamando a função extract_income_statements.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, baseYear } = await req.json();
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
          { role: "user", content: `Ano-base: ${baseYear || new Date().getFullYear()}\n\nTexto extraído:\n${text.slice(0, 30000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_income_statements",
            description: "Extrai informes de rendimentos estruturados",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source_name: { type: "string", description: "Nome da fonte pagadora" },
                      source_cnpj: { type: "string", description: "CNPJ (apenas números) — opcional" },
                      taxable_income: { type: "number", description: "Rendimentos tributáveis em BRL" },
                      exempt_income: { type: "number", description: "Rendimentos isentos em BRL" },
                      ir_withheld: { type: "number", description: "IR retido na fonte em BRL" },
                      contributions: { type: "number", description: "Contribuição previdenciária em BRL" },
                      classification: { type: "string", enum: ["tributavel", "isento", "exclusivo_fonte", "indefinido"] },
                      warnings: { type: "array", items: { type: "string" }, description: "Alertas de inconsistências" },
                    },
                    required: ["source_name", "taxable_income", "exempt_income", "ir_withheld", "contributions", "classification"],
                  },
                },
              },
              required: ["items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_income_statements" } },
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
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { items: [] };

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-income-statement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
