import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Recebe um snapshot financeiro da empresa (já agregado pelo cliente,
 * respeitando RLS) e devolve diagnóstico, gargalos, oportunidades,
 * recomposição de margem e estratégias de marketing — em Markdown.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { snapshot } = await req.json();

    const systemPrompt = `Você é um consultor financeiro e estrategista de crescimento sênior, especialista em PMEs brasileiras. Sua missão é analisar o snapshot financeiro de uma empresa e produzir um diagnóstico ACIONÁVEL.

Estruture sua resposta em Markdown com EXATAMENTE estas seções:

## 🩺 Diagnóstico Geral
Resumo de 3-5 linhas sobre a saúde financeira atual.

## ⚠️ Principais Falhas e Gargalos
Lista bullets com até 5 problemas concretos identificados nos dados.

## 🚀 Oportunidades de Crescimento
Lista bullets com até 5 oportunidades, sempre ligadas aos dados.

## 💰 Recomposição de Margem
Para cada produto/serviço com margem baixa nos dados, sugira:
- Ajuste de preço sugerido (com %)
- Onde reduzir custo
- Como reposicionar

## 📣 Estratégias de Marketing
Sugestões para aumentar ticket médio, recorrência e conversão.
Inclua exemplos concretos: upsell, cross-sell, pacotes, promoções inteligentes.

Use BRL (R$) sempre. Seja direto, sem encheção. Cite números reais do snapshot quando possível.`;

    const userPrompt = `Snapshot financeiro da empresa:\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n\nGere o diagnóstico completo seguindo a estrutura.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso temporariamente atingido. Tente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos em Lovable Cloud." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ markdown: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("imperar-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
