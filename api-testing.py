from langchain_openai import ChatOpenAI
import httpx

client = httpx.Client(verify=False)
llm = ChatOpenAI(
    base_url ="https://genailab.tcs.in",
    model = "azure/genailab-maas-gpt-4o-mini",
    api_key = "sk-JBIPJpgZRpuszGX2shenqw",
    http_client = client
)

response = llm.invoke('Hi')
print(response)