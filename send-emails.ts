import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";
import * as base64 from "https://deno.land/std@0.224.0/encoding/base64.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Header CORS untuk mengizinkan permintaan dari domain manapun
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Tangani permintaan OPTIONS (pre-flight request)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== "POST") {
            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        // Dapatkan data dari permintaan
        const formData = await req.formData();
        const file = formData.get("file");
        const attachments = formData.getAll("attachments");
        const subject = formData.get("subject") as string;
        const message = formData.get("message") as string;

        // Validasi data
        if (!file || !(file instanceof Blob) || !subject || !message) {
            return new Response(JSON.stringify({ status: "error", message: "Missing or invalid form data." }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Baca konten file penerima
        const fileContent = await file.text();
        const records = await parse(fileContent, {
            skipFirstRow: true,
        }) as { email: string }[];
        
        const recipients = records.map(record => record.email).filter(Boolean); // Filter out empty emails
        
        if (recipients.length === 0) {
            return new Response(JSON.stringify({ status: "error", message: "No valid email addresses found in the file." }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Proses lampiran
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
        
        // Kirim email menggunakan Resend
        const { data, error } = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: recipients,
            subject: subject,
            html: `<p>${message}</p>`,
            attachments: resendAttachments,
        });

        if (error) {
            console.error("Resend API Error:", error);
            return new Response(JSON.stringify({ status: "error", message: `Failed to send emails via Resend: ${error.message}` }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ status: "success", message: "Emails sent." }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return new Response(JSON.stringify({ status: "error", message: `Internal server error: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
