import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";
import * as base64 from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Inisialisasi Resend dengan kunci API dari variabel lingkungan Supabase
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Atur header CORS default untuk semua respons
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Endpoint untuk menerima permintaan dari frontend
serve(async (req) => {
    // Tangani permintaan OPTIONS/pre-flight request dari browser
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const method = req.method;

        if (url.pathname === "/send-emails" && method === "POST") {
            const formData = await req.formData();
            const file = formData.get("file");
            const attachments = formData.getAll("attachments");
            const subject = formData.get("subject") as string;
            const message = formData.get("message") as string;

            if (!file || !subject || !message) {
                return new Response(JSON.stringify({ status: "error", message: "Missing required fields." }), { 
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const fileContent = await (file as Blob).text();
            
            const records = await parse(fileContent, {
                skipFirstRow: true,
            }) as { email: string }[];
            
            const recipients = records.map(record => record.email);
            
            if (recipients.length === 0) {
                return new Response(JSON.stringify({ status: "error", message: "No recipients found in the file." }), { 
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const resendAttachments = [];
            for (const attachment of attachments) {
                if (attachment instanceof Blob) {
                    const arrayBuffer = await attachment.arrayBuffer();
                    const base64Content = base64.encode(new Uint8Array(arrayBuffer));
                    resendAttachments.push({
                        filename: (attachment as File).name,
                        content: base64Content,
                    });
                }
            }

            const { data, error } = await resend.emails.send({
                from: "onboarding@resend.dev",
                to: recipients,
                subject: subject,
                html: `<p>${message}</p>`,
                attachments: resendAttachments,
            });

            if (error) {
                console.error("Resend API Error:", error);
                return new Response(JSON.stringify({ status: "error", message: "Failed to send emails via Resend." }), { 
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            console.log("Emails sent successfully:", data);
            return new Response(JSON.stringify({ status: "success", message: "Emails sent." }), { 
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        console.error("Internal Server Error:", error);
        return new Response(JSON.stringify({ status: "error", message: "Internal server error." }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    // Tangani jalur atau metode yang tidak valid
    return new Response('Not Found', { status: 404, headers: corsHeaders });
});
